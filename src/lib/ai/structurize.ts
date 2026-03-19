import { z } from "zod";
import {
  getChatClient,
  getChatModel,
  getEmbeddingClient,
  getEmbeddingModel,
} from "./client";

/** 模型有时包在 ```json ``` 里或前后带说明文字，从中取出可 JSON.parse 的对象 */
function parseJsonObjectFromModelContent(content: string): unknown {
  let s = content.trim();
  if (!s) throw new Error("模型返回内容为空");

  const fence =
    /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/m.exec(s) ??
    /```(?:json)?\s*([\s\S]*?)```/.exec(s);
  if (fence) s = fence[1].trim();

  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(
      `无法从模型输出中解析 JSON（开头片段）：${s.slice(0, 240).replace(/\s+/g, " ")}`
    );
  }
  const slice = s.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`JSON 解析失败：${msg}`);
  }
}

const stringOrStringArray = z
  .union([z.array(z.string()), z.string()])
  .transform((v) =>
    Array.isArray(v) ? v : typeof v === "string" && v.trim() ? [v.trim()] : []
  );

const difficultySchema = z
  .union([z.number(), z.string()])
  .transform((v) => {
    const n = typeof v === "number" ? v : parseInt(String(v).trim(), 10);
    if (!Number.isFinite(n) || n < 1 || n > 5) return 3;
    return n;
  });

const StructuredQuestionSchema = z.object({
  title: z.string().min(1).describe("题目标题，简洁描述考查内容"),
  knowledge: stringOrStringArray.describe("涉及的知识点"),
  method: stringOrStringArray.describe("解题方法"),
  thought: stringOrStringArray.describe("数学思想"),
  difficulty: difficultySchema.describe("难度评分 1-5"),
  analysis: z.string().describe("详细解析，分步骤，支持 LaTeX 公式"),
  answer: z.string().describe("标准答案"),
  errorProne: z.string().optional().default("").describe("易错点提示"),
  variantDirection: z.string().optional().default("").describe("变式方向提示"),
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

请严格按照 JSON 格式输出（json_object 模式），LaTeX 公式使用 $ 包裹行内公式，$$ 包裹块级公式。

你必须输出**仅一个** JSON 对象，包含且仅包含这些键：title, knowledge, method, thought, difficulty, analysis, answer, errorProne, variantDirection。其中 knowledge、method、thought 为字符串数组；difficulty 为 1-5 的整数。不要 markdown 代码块包裹。`;

export async function structurizeQuestion(
  rawText: string
): Promise<StructuredQuestion> {
  const openai = getChatClient();
  const response = await openai.chat.completions.create({
    model: getChatModel(),
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `请分析以下高中数学题目，提取结构化信息并生成详细解析（输出上述 JSON 对象）：\n\n${rawText}`,
      },
    ],
    temperature: 0.2,
    max_tokens: 8192,
  });

  const jsonStr = response.choices[0]?.message?.content ?? "";
  const parsed = parseJsonObjectFromModelContent(jsonStr);
  const result = StructuredQuestionSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 6)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`结构化字段校验失败：${issues || result.error.message}`);
  }
  return result.data;
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
  const openai = getChatClient();
  const response = await openai.chat.completions.create({
    model: getChatModel(),
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

请输出 JSON 格式，包含 variants 数组（json_object，键为 variants）。`,
      },
    ],
    temperature: 0.7,
    max_tokens: 8192,
  });

  const jsonStr = response.choices[0]?.message?.content ?? "";
  const parsed = parseJsonObjectFromModelContent(jsonStr);
  return VariantSchema.parse(parsed);
}

export async function explainQuestion(
  question: string,
  analysis: string,
  userQuery: string
): Promise<ReadableStream<Uint8Array>> {
  const openai = getChatClient();
  const stream = await openai.chat.completions.create({
    model: getChatModel(),
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
  const openai = getEmbeddingClient();
  if (!openai) {
    throw new Error(
      "未配置向量接口：请设置 OPENAI_API_KEY 或 AI_EMBEDDING_API_KEY（用于 text-embedding，相似题/结构化写库需要）。若仅使用 DeepSeek 对话，可另配一个 OpenAI Key 专用于 embedding。"
    );
  }
  const response = await openai.embeddings.create({
    model: getEmbeddingModel(),
    input: text.slice(0, 8000), // 限制长度
  });
  return response.data[0].embedding;
}
