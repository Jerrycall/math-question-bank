import { z } from "zod";
import { openai } from "./client";

const StructuredQuestionSchema = z.object({
  title: z.string().describe("题目标题，简洁描述考查内容"),
  knowledge: z.array(z.string()).describe("涉及的知识点，如：导数、单调性、函数"),
  method: z.array(z.string()).describe("解题方法，如：导数法、分类讨论、配方法"),
  thought: z.array(z.string()).describe("数学思想，如：函数思想、转化思想、数形结合"),
  difficulty: z.number().min(1).max(5).describe("难度评分 1-5"),
  analysis: z.string().describe("详细解析，分步骤，支持 LaTeX 公式"),
  answer: z.string().describe("标准答案"),
  errorProne: z.string().describe("易错点提示"),
  variantDirection: z.string().describe("变式方向提示"),
});

export type StructuredQuestion = z.infer<typeof StructuredQuestionSchema>;

const SYSTEM_PROMPT = `你是一位专业的高中数学教师，擅长分析数学题目的知识结构。

## 高中数学知识体系

### 知识点（参考）
- **函数**：二次函数、指数函数、对数函数、三角函数、反三角函数
- **导数**：导数定义、导数运算、单调性、极值、最值、切线方程
- **数列**：等差数列、等比数列、数列求和、数学归纳法
- **不等式**：基本不等式、均值不等式、绝对值不等式
- **解析几何**：直线、圆、椭圆、双曲线、抛物线
- **立体几何**：空间向量、三视图、面积体积
- **概率统计**：古典概型、条件概率、正态分布、统计

### 解题方法（参考）
- 导数法、配方法、换元法、数形结合法
- 分类讨论法、反证法、数学归纳法
- 待定系数法、参数法、向量法

### 数学思想（参考）
- 函数思想、方程思想、转化思想
- 数形结合思想、分类讨论思想、化归思想
- 极限思想、优化思想

请严格按照 JSON 格式输出，LaTeX 公式使用 $ 包裹行内公式，$$ 包裹块级公式。`;

export async function structurizeQuestion(
  rawText: string
): Promise<StructuredQuestion> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `请分析以下高中数学题目，提取结构化信息并生成详细解析：\n\n${rawText}`,
      },
    ],
    temperature: 0.2,
  });

  const jsonStr = response.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(jsonStr);
  return StructuredQuestionSchema.parse(parsed);
}

const VariantSchema = z.object({
  variants: z.array(
    z.object({
      level: z.enum(["easier", "same", "harder"]),
      title: z.string(),
      question: z.string(),
      answer: z.string(),
      analysis: z.string(),
      changedAspect: z.string().describe("与原题相比改变了哪些条件"),
    })
  ),
});

export type VariantQuestions = z.infer<typeof VariantSchema>;

export async function generateVariants(
  originalQuestion: string,
  originalAnalysis: string
): Promise<VariantQuestions> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `请为以下题目生成3道变式题（分别为"更简单"、"相同难度"、"更难"），保持相同的知识点和方法，但改变条件或问法：

## 原题
${originalQuestion}

## 原解析
${originalAnalysis}

请输出 JSON 格式，包含 variants 数组。`,
      },
    ],
    temperature: 0.7,
  });

  const jsonStr = response.choices[0].message.content ?? "{}";
  const parsed = JSON.parse(jsonStr);
  return VariantSchema.parse(parsed);
}

export async function explainQuestion(
  question: string,
  analysis: string,
  userQuery: string
): Promise<ReadableStream<Uint8Array>> {
  const stream = await openai.chat.completions.create({
    model: "gpt-4o",
    stream: true,
    messages: [
      {
        role: "system",
        content:
          "你是一位耐心的高中数学老师，用通俗易懂的语言解释数学题目。使用 LaTeX 公式（$ 包裹），分步骤讲解，适当使用比喻和类比帮助理解。",
      },
      {
        role: "user",
        content: `## 题目\n${question}\n\n## 参考解析\n${analysis}\n\n## 学生提问\n${userQuery}`,
      },
    ],
    temperature: 0.5,
  });

  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) controller.enqueue(encoder.encode(text));
      }
      controller.close();
    },
  });
}

export async function getEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000), // 限制长度
  });
  return response.data[0].embedding;
}
