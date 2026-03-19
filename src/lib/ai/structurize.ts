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

const GgbCommandSchema = z.object({
  commands: z
    .union([z.array(z.string()), z.string()])
    .transform((v) =>
      Array.isArray(v)
        ? v
        : String(v)
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean)
    )
    .pipe(z.array(z.string().min(1)).min(1))
    .describe("GeoGebra 命令行列表，每行一个可直接粘贴到输入栏的命令"),
  summary: z
    .string()
    .optional()
    .default("")
    .describe("简要说明作图思路与命令执行顺序"),
  notes: z
    .union([z.array(z.string()), z.string()])
    .transform((v) =>
      Array.isArray(v)
        ? v
        : String(v)
            .split(/\r?\n|；|;/)
            .map((s) => s.trim())
            .filter(Boolean)
    )
    .pipe(z.array(z.string()))
    .optional()
    .default([])
    .describe("可选注意事项，如参数范围、坐标窗口设置"),
});

export type GgbCommandResult = z.infer<typeof GgbCommandSchema>;

const stringListField = z
  .union([z.array(z.string()), z.string()])
  .transform((v) =>
    Array.isArray(v)
      ? v
      : String(v)
          .split(/\r?\n|；|;/)
          .map((s) => s.trim())
          .filter(Boolean)
  );

const GgbPlanSchema = z.object({
  knownObjects: stringListField.default([]).describe("题干已知对象（方程、点、常量）"),
  constructions: stringListField.default([]).describe("构造命令（线、交点、切线等）"),
  metrics: stringListField.default([]).describe("计算命令（距离、斜率、点积等）"),
  labels: stringListField.default([]).describe("可选标注命令"),
  summary: z.string().optional().default(""),
  notes: stringListField.optional().default([]),
});

type GgbPlan = z.infer<typeof GgbPlanSchema>;

type GgbGenerateContext = {
  answer?: string;
  analysis?: string;
  tags?: string[];
};

function normalizeForCompare(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

function extractEquationHints(text: string): string[] {
  const hints: string[] = [];
  const source = text.replace(/\$/g, " ");
  const eqRegex = /([xy][^=,\n，。；;]{0,50}=[^,\n，。；;]{1,60})/gi;
  const matches = source.match(eqRegex) ?? [];
  for (const raw of matches) {
    const eq = raw
      .replace(/[：:]/g, "")
      .replace(/\s+/g, "")
      .trim();
    if (!eq.includes("=")) continue;
    if (!/[xy]/i.test(eq)) continue;
    if (eq.length < 3 || eq.length > 80) continue;
    // 仅保留“纯数学字符”方程，避免把中文说明拼进命令
    const asciiLikeMath = /^[A-Za-z0-9_+\-*/^=().,<>|[\]{}\\]*$/;
    if (!asciiLikeMath.test(eq)) continue;
    hints.push(eq);
  }
  return Array.from(new Set(hints)).slice(0, 6);
}

function buildParabolaMustHaveCommands(
  questionText: string,
  context?: GgbGenerateContext
): string[] {
  const combined = [
    questionText,
    context?.answer ?? "",
    context?.analysis ?? "",
  ].join("\n");
  if (!combined.includes("抛物线")) return [];

  const eqs = extractEquationHints(combined);
  const parabolaLike = eqs.filter(
    (eq) =>
      /y=/i.test(eq) &&
      /(x\^2|x²)/i.test(eq) &&
      !/(sqrt|√)/i.test(eq)
  );
  return parabolaLike.slice(0, 2);
}

function extractPointHints(text: string): string[] {
  const hints: string[] = [];
  const pointRegex = /([A-Z])\s*\(\s*([^\(\)]{1,40}?)\s*,\s*([^\(\)]{1,40}?)\s*\)/g;
  // 只接受坐标是"纯数值表达式"的点，拒绝符号变量（x_1, y_1, t, ...）
  const isNumeric = (s: string) =>
    /^-?[0-9]/.test(s) && // 必须以数字或负号开头
    /^[0-9\-+*/^().sqrt\s√]*$/.test(s.replace(/sqrt/g, "").replace(/√/g, ""));
  let m: RegExpExecArray | null = pointRegex.exec(text);
  while (m) {
    const name = m[1];
    const x = m[2].trim();
    const y = m[3].trim();
    // 过滤掉符号坐标（如 x_1、y₁、a、t 等变量名）
    if (name && x && y && isNumeric(x) && isNumeric(y)) {
      hints.push(`${name}=(${x},${y})`);
    }
    m = pointRegex.exec(text);
  }
  return Array.from(new Set(hints)).slice(0, 8);
}

function normalizeGgbCommandLine(line: string): string {
  return line
    .trim()
    .replace(/^[-*]\s+/, "")
    .replace(/^\d+[\.\)]\s+/, "")
    .replace(/^`|`$/g, "");
}

function sanitizeGgbCommandLine(line: string): string {
  let s = normalizeGgbCommandLine(line);
  if (!s) return "";

  // 过滤说明性文本（非命令）
  if (
    /^note\s*:|^tips?\s*:|^summary\s*:/i.test(s) ||
    /^the\s+/i.test(s) ||
    /^if\s+/i.test(s)
  ) {
    return "";
  }
  // 含中文通常是解释文本，不是可执行命令
  if (/[\u4e00-\u9fff]/.test(s)) return "";

  // 移除行内注释（保留真正命令）
  s = s.replace(/\s*(\/\/|#).+$/, "").trim();
  if (!s) return "";

  // 若是 Text("...", P, (0,1)) 这类易报错写法，退化为 Text("...", P)
  s = s.replace(
    /^Text\(\s*("[^"]*"|'[^']*')\s*,\s*([^,()]+(?:\([^)]*\))?)\s*,\s*\([^)]*\)\s*\)$/i,
    'Text($1, $2)'
  );

  // GeoGebra 中笛卡尔点建议写成 A=(x,y)，避免 Point(x,y) 语法不兼容
  s = s.replace(
    /^([A-Za-z][A-Za-z0-9_]*)\s*=\s*Point\(\s*([^,]+)\s*,\s*([^)]+)\s*\)\s*$/i,
    "$1=($2,$3)"
  );

  // 至少应像命令：
  //   1) 函数调用或独立命令：Circle(A, r)、Intersect(f,g) 等
  //   2) 赋值 / 方程：A=(1,0)、f(x)=x^2+1、x^2+y^2=1 等（含 = 的都算）
  const looksLikeCommand =
    (s.includes("(") && s.endsWith(")")) || s.includes("=");
  if (!looksLikeCommand) return "";

  return s;
}

function compilePlanToCommands(
  plan: GgbPlan,
  mustHave: string[],
  mustHaveParabola: string[]
): string[] {
  const staged = [
    ...mustHaveParabola,
    ...mustHave,
    ...plan.knownObjects,
    ...plan.constructions,
    ...plan.metrics,
    ...plan.labels,
  ];
  const dedup = new Set<string>();
  const out: string[] = [];
  for (const raw of staged) {
    const cmd = sanitizeGgbCommandLine(raw);
    if (!cmd) continue;
    const key = normalizeForCompare(cmd);
    if (dedup.has(key)) continue;
    dedup.add(key);
    out.push(cmd);
    if (out.length >= 20) break;
  }
  return out;
}

function computeCoverageScore(commands: string[], mustHave: string[]): number {
  if (mustHave.length === 0) return 1;
  const existing = new Set(commands.map(normalizeForCompare));
  let hit = 0;
  for (const item of mustHave) {
    if (existing.has(normalizeForCompare(item))) hit += 1;
  }
  return hit / mustHave.length;
}

function validateCommands(commands: string[]): {
  ok: boolean;
  issues: string[];
  unknownRefs: string[];
} {
  const issues: string[] = [];
  const unknownRefs = new Set<string>();
  const defined = new Set<string>([
    "x",
    "y",
    "z",
    "pi",
    "e",
    "XAxis",
    "YAxis",
    "xAxis",
    "yAxis",
  ]);
  const builtins = new Set<string>([
    // math functions
    "sqrt", "sin", "cos", "tan", "asin", "acos", "atan", "abs",
    "exp", "ln", "log", "floor", "ceil", "round", "min", "max",
    "mod", "gcd", "lcm", "nroot",
    // GeoGebra commands
    "Point", "Line", "Segment", "Circle", "Ellipse", "Hyperbola",
    "Parabola", "Intersect", "Distance", "Midpoint", "Slope",
    "Function", "Text", "Dot", "Cross", "Vector", "Ray",
    "Tangent", "Normal", "Perpendicular", "Parallel",
    "Polygon", "Triangle", "Rectangle",
    "Reflect", "Rotate", "Translate", "Dilate",
    "Area", "Perimeter", "Length", "Angle",
    "IntersectRegion", "Sequence", "Sum",
    // common GeoGebra pre-defined objects
    "xAxis", "yAxis", "XAxis", "YAxis",
    "Origin", "O",
    // single letters are valid GeoGebra names for functions/lines/points
    "a","b","c","d","e","f","g","h","i","j","k","l","m",
    "n","o","p","q","r","s","t","u","v","w",
    "A","B","C","D","E","F","G","H","I","J","K","L","M",
    "N","P","Q","R","S","T","U","V","W",
  ]);

  const symbolRegex = /\b([A-Za-z][A-Za-z0-9_]*)\b/g;
  for (let i = 0; i < commands.length; i += 1) {
    const cmd = commands[i];
    const assign = cmd.match(/^\s*([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+)$/);
    if (assign) {
      const lhs = assign[1];
      const rhs = assign[2];
      let m: RegExpExecArray | null = symbolRegex.exec(rhs);
      while (m) {
        const sym = m[1];
        const prev = rhs[m.index - 1];
        if (prev !== "." && !builtins.has(sym) && !defined.has(sym)) {
          unknownRefs.add(sym);
        }
        m = symbolRegex.exec(rhs);
      }
      defined.add(lhs);
      continue;
    }

    let m: RegExpExecArray | null = symbolRegex.exec(cmd);
    while (m) {
      const sym = m[1];
      const next = cmd[m.index + sym.length];
      const isFuncName = next === "(";
      if (isFuncName && builtins.has(sym)) {
        m = symbolRegex.exec(cmd);
        continue;
      }
      if (!builtins.has(sym) && !defined.has(sym)) {
        unknownRefs.add(sym);
      }
      m = symbolRegex.exec(cmd);
    }
  }

  if (unknownRefs.size > 0) {
    issues.push(`可能存在未定义符号：${Array.from(unknownRefs).slice(0, 8).join(", ")}`);
  }
  return { ok: issues.length === 0, issues, unknownRefs: Array.from(unknownRefs) };
}

export async function generateGgbCommands(
  questionText: string,
  userIntent?: string,
  context?: GgbGenerateContext
): Promise<GgbCommandResult> {
  const openai = getChatClient();
  const equationHints = extractEquationHints(questionText);
  const pointHints = extractPointHints(questionText);
  const parabolaMustHave = buildParabolaMustHaveCommands(questionText, context);
  const extraContext = [
    context?.answer?.trim() ? `参考答案：\n${context.answer.trim()}` : "",
    context?.analysis?.trim() ? `参考解析：\n${context.analysis.trim()}` : "",
    context?.tags?.length ? `标签：${context.tags.join("、")}` : "",
    equationHints.length
      ? `题干提取到的已知方程（应优先直接体现在命令中）：\n${equationHints.join("\n")}`
      : "",
    pointHints.length
      ? `题干提取到的已知点（应优先直接体现在命令中）：\n${pointHints.join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const mustHave = [...equationHints, ...pointHints];
  const mustHaveParabola = parabolaMustHave;

  const tryPlanCompile = async (
    extraConstraint?: string
  ): Promise<GgbCommandResult | null> => {
    const planResp = await openai.chat.completions.create({
      model: getChatModel(),
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `你是 GeoGebra 作图规划器。先输出“对象计划”，不要直接写解释。

返回 JSON 键：
- knownObjects: 已知对象命令（方程/点）
- constructions: 构造命令
- metrics: 计算量命令
- labels: 标签命令（可选）
- summary, notes

约束：
1) 每项必须是单行 GeoGebra 命令候选（不是自然语言）。
2) 先定义后使用，自包含。
3) 坐标点使用 A=(x,y)，不用 Point(x,y)。`,
        },
        {
          role: "user",
          content: `题目内容：\n${questionText}\n\n作图需求：\n${
            userIntent?.trim() || "按题意给出标准作图命令"
          }${extraContext ? `\n\n补充上下文：\n${extraContext}` : ""}${
            extraConstraint ? `\n\n额外硬约束：\n${extraConstraint}` : ""
          }\n\n请返回 JSON。`,
        },
      ],
      temperature: 0.1,
      max_tokens: 2200,
    });

    const planJson = planResp.choices[0]?.message?.content ?? "";
    const planParsed = parseJsonObjectFromModelContent(planJson);
    const planResult = GgbPlanSchema.safeParse(planParsed);
    if (!planResult.success) return null;

    const plannedCommands = compilePlanToCommands(
      planResult.data,
      mustHave,
      mustHaveParabola
    );
    if (plannedCommands.length < 3) return null;

    const allMustHave = [...mustHaveParabola, ...mustHave];
    const coverage = computeCoverageScore(plannedCommands, allMustHave);
    if (allMustHave.length > 0 && coverage < 0.6) return null;

    const validation = validateCommands(plannedCommands);
    const validationNotes =
      validation.issues.length > 0
        ? [`[静态检查提示] ${validation.issues.join("; ")}`]
        : [];
    const baseNotes = Array.isArray(planResult.data.notes)
      ? planResult.data.notes
      : planResult.data.notes
      ? [planResult.data.notes as string]
      : [];

    return {
      commands: plannedCommands,
      summary: planResult.data.summary,
      notes: [...baseNotes, ...validationNotes],
    };
  };

  // 1) IR 计划模式：先产对象计划，再由规则编译为命令（更稳定）
  try {
    const first = await tryPlanCompile(
      `以下对象必须覆盖：${[...mustHaveParabola, ...mustHave].join(" ; ")}。且不要出现未定义符号。`
    );
    if (first) return first;
  } catch {
    // 计划模式失败时回退到直接命令模式
  }

  const response = await openai.chat.completions.create({
    model: getChatModel(),
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `你是一位 GeoGebra 作图助手，帮助高中数学题生成可执行命令。

输出要求（严格）：
1) 仅输出一个 JSON 对象，键为 commands、summary、notes。
2) commands 中每一项必须是单行 GeoGebra 命令（不要解释文字、不要 markdown 代码块）。
3) 命令必须可直接在 GeoGebra Classic 输入栏执行，避免自然语言、伪代码、中文标点。
4) 按“先定义基础对象，再构造目标对象，最后标注关键量”的顺序输出。
5) 优先使用这些可执行语法：Point / Line / Segment / Circle / Ellipse / Hyperbola / Parabola / Intersect / Distance / Midpoint / Slope / Function。
6) 如果题目信息不足，先生成通用可运行骨架命令，并在 notes 说明还需补充的条件。
7) 至少返回 3 条命令；命令总数不超过 20 条。
8) 不要输出任何英文说明行；严禁输出诸如 "The commands are ..." 这类描述句。
9) 尽量不要使用 Text 命令；如必须使用，只允许 Text("标签", 点对象) 两参数形式。
10) commands 必须自包含：所有符号在使用前先定义，不依赖外部已存在对象。
11) 若使用函数，先定义如 f(x)=...，调用时写 f(1)；不要把未定义符号直接当坐标（如 Point(f,1)）。
12) 创建坐标点时不要使用 Point(x,y)；统一使用赋值坐标形式，如 A=(1,0)、M=(2*sqrt(2)/3,-1/3)。
13) 若题干给了明确方程/点坐标，commands 前几行必须先把这些已知对象画出来，再做后续构造。`,
      },
      {
        role: "user",
        content: `题目内容：\n${questionText}\n\n作图需求（可选）：\n${
          userIntent?.trim() || "按题意给出标准作图命令"
        }${extraContext ? `\n\n补充上下文：\n${extraContext}` : ""}\n\n请返回 JSON。`,
      },
    ],
    temperature: 0.1,
    max_tokens: 2200,
  });

  const jsonStr = response.choices[0]?.message?.content ?? "";
  const parsed = parseJsonObjectFromModelContent(jsonStr);
  const result = GgbCommandSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 6)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`GGB 命令格式校验失败：${issues || result.error.message}`);
  }
  const normalizedCommands = result.data.commands
    .map(sanitizeGgbCommandLine)
    .filter(Boolean);
  if (normalizedCommands.length === 0) {
    throw new Error("GGB 命令为空，请重试。");
  }

  // 回退模式下把题干中的明确已知对象前置，提升“贴题度”
  const existing = new Set(normalizedCommands.map(normalizeForCompare));
  const missingMustHave = mustHave.filter(
    (h) => !existing.has(normalizeForCompare(h))
  );
  const missingParabola = mustHaveParabola.filter(
    (h) => !existing.has(normalizeForCompare(h))
  );
  const merged = [...missingParabola, ...missingMustHave, ...normalizedCommands].slice(0, 20);
  const fallbackValidation = validateCommands(merged);
  const fallbackNotes = [
    ...(result.data.notes ?? []),
    ...(fallbackValidation.ok ? [] : fallbackValidation.issues),
  ];

  return {
    ...result.data,
    commands: merged,
    notes: fallbackNotes,
  };
}

export async function repairGgbCommands(
  questionText: string,
  currentCommands: string[],
  failedLine: string,
  errorHint?: string,
  userIntent?: string,
  context?: GgbGenerateContext
): Promise<GgbCommandResult> {
  const openai = getChatClient();
  const response = await openai.chat.completions.create({
    model: getChatModel(),
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `你是 GeoGebra 命令修复器。请基于“已有命令 + 报错行”修复为可执行版本。

硬性要求：
1) 仅输出 JSON 对象：commands, summary, notes。
2) commands 每项是一行可执行 GeoGebra 命令。
3) 保留原命令含义，最小改动修复。
4) 命令必须自包含，先定义后使用。
5) 坐标点统一写 A=(x,y)，不要写 Point(x,y)。
6) 不输出解释性英文句子，不要 markdown。`,
      },
      {
        role: "user",
        content: `题目：\n${questionText}

作图需求：\n${userIntent?.trim() || "按题意作图"}

参考答案：\n${context?.answer?.trim() || "(无)"}

参考解析：\n${context?.analysis?.trim() || "(无)"}

当前命令（待修复）：
${currentCommands.join("\n")}

执行失败命令：
${failedLine}

错误信息（若有）：
${errorHint?.trim() || "(无)"}\n\n请返回修复后的完整 commands。`,
      },
    ],
    temperature: 0.1,
    max_tokens: 2200,
  });

  const jsonStr = response.choices[0]?.message?.content ?? "";
  const parsed = parseJsonObjectFromModelContent(jsonStr);
  const result = GgbCommandSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 6)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`GGB 修复结果校验失败：${issues || result.error.message}`);
  }

  const normalizedCommands = result.data.commands
    .map(sanitizeGgbCommandLine)
    .filter(Boolean)
    .slice(0, 20);
  if (normalizedCommands.length === 0) {
    throw new Error("修复后命令为空");
  }

  return {
    ...result.data,
    commands: normalizedCommands,
  };
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
