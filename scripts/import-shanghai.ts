/**
 * 上海高三复习题集（流墨轩格式）→ 题库导入
 * 保留原标签：知识点、方法、思想、来源、题型
 * 运行：npx ts-node --project tsconfig.scripts.json scripts/import-shanghai.ts
 */

import { PrismaClient, Difficulty, TagType } from "@prisma/client";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import matter from "gray-matter";

const db = new PrismaClient();

const SOURCE_DIR =
  process.env.SHANGHAI_QUESTIONS_DIR ||
  "/Users/zhouzhijie/cursor/流墨轩·AI教研 - 新教研员/数学-高中知识库/03-练习题库/上海高三复习题集/题目库";

// 难度 ★ 数量 → 枚举
function starsToDifficulty(stars: string): Difficulty {
  const n = (stars || "★★★").replace(/[^★]/g, "").length;
  if (n <= 1) return "EASY";
  if (n === 2) return "MEDIUM_LOW";
  if (n === 3) return "MEDIUM";
  if (n === 4) return "MEDIUM_HIGH";
  return "HARD";
}

// 从正文提取 题目 / 答案 / 解析
function extractSections(body: string): { question: string; answer: string; analysis: string } {
  const questionMatch = body.match(/\*\*题目\*\*\s*[\n\r]+([\s\S]*?)\s*\*\*答案\*\*/i);
  const answerMatch = body.match(/\*\*答案\*\*\s*[\n\r]+([\s\S]*?)\s*\*\*解析\*\*/i);
  const analysisMatch = body.match(/\*\*解析\*\*\s*[\n\r]+([\s\S]*)/i);

  return {
    question: questionMatch ? questionMatch[1].trim() : "",
    answer: answerMatch ? answerMatch[1].trim() : "",
    analysis: analysisMatch ? analysisMatch[1].trim() : "",
  };
}

function slugify(name: string): string {
  return name
    .replace(/\s+/g, "-")
    .replace(/[^\w\-\u4e00-\u9fa5]/g, "")
    .replace(/\-\-+/g, "-")
    .trim()
    .toLowerCase() || "tag";
}

async function getOrCreateTag(name: string, type: TagType): Promise<string> {
  const slug = slugify(name);
  const tag = await db.tag.upsert({
    where: { slug },
    create: { name, slug, type },
    update: {},
  });
  return tag.id;
}

async function importOne(filePath: string): Promise<void> {
  const raw = readFileSync(filePath, "utf-8");
  const { data: fm, content: body } = matter(raw);

  const id = (fm.id as string) || "unknown";
  const slug = `shanghai-${id}`;
  const 题型 = (fm.题型 as string) || "";
  const 难度 = starsToDifficulty((fm.难度 as string) || "★★★");
  const 知识点 = (fm.知识点 as string[]) || [];
  const 方法 = (fm.方法 as string[]) || [];
  const 思想 = (fm.思想 as string[]) || [];
  const 来源 = (fm.来源 as string) || "上海高三复习题集";
  const 年份 = typeof fm.年份 === "number" ? fm.年份 : undefined;

  const { question, answer, analysis } = extractSections(body);
  if (!question) {
    console.warn(`跳过（无题目内容）：${filePath}`);
    return;
  }

  const title = `${id} · ${题型} · ${来源.split("·")[0] || 来源}`.slice(0, 200);

  const tagIds: string[] = [];

  for (const name of 知识点) {
    if (name && String(name).trim()) tagIds.push(await getOrCreateTag(String(name).trim(), "KNOWLEDGE"));
  }
  for (const name of 方法) {
    if (name && String(name).trim()) tagIds.push(await getOrCreateTag(String(name).trim(), "METHOD"));
  }
  for (const name of 思想) {
    if (name && String(name).trim()) tagIds.push(await getOrCreateTag(String(name).trim(), "THOUGHT"));
  }
  if (来源 && String(来源).trim()) {
    tagIds.push(await getOrCreateTag(来源.trim(), "SOURCE"));
  }
  // 按年份单独打「来源」标签，便于与「来源文字包含」筛选、侧栏点选一致
  if (typeof 年份 === "number" && 年份 >= 1900 && 年份 <= 2100) {
    tagIds.push(await getOrCreateTag(`${年份}年`, "SOURCE"));
  }
  if (题型 && String(题型).trim()) {
    tagIds.push(await getOrCreateTag(`题型：${题型.trim()}`, "SOURCE"));
  }

  const uniqueTagIds = Array.from(new Set(tagIds));

  await db.question.upsert({
    where: { slug },
    create: {
      slug,
      title,
      content: question,
      answer: answer || "（见解析）",
      analysis: analysis || "",
      difficulty: 难度,
      source: 来源,
      sourceYear: 年份 ?? undefined,
      mdFilePath: filePath,
      tags: {
        create: uniqueTagIds.map((tagId) => ({ tagId })),
      },
    },
    update: {
      title,
      content: question,
      answer: answer || "（见解析）",
      analysis: analysis || "",
      difficulty: 难度,
      source: 来源,
      sourceYear: 年份 ?? undefined,
      mdFilePath: filePath,
      tags: {
        deleteMany: {},
        create: uniqueTagIds.map((tagId) => ({ tagId })),
      },
    },
  });

  console.log(`✅ ${slug} · ${题型}`);
}

async function main() {
  console.log(`📂 题目库目录：${SOURCE_DIR}\n`);

  let files: string[];
  try {
    files = readdirSync(SOURCE_DIR)
      .filter((f) => f.endsWith(".md"))
      .map((f) => join(SOURCE_DIR, f));
  } catch (e) {
    console.error("无法读取目录，请检查 SHANGHAI_QUESTIONS_DIR 或默认路径。", e);
    process.exit(1);
  }

  console.log(`📝 共 ${files.length} 个 .md 文件\n`);

  let ok = 0;
  let fail = 0;

  for (const file of files) {
    try {
      await importOne(file);
      ok++;
    } catch (err) {
      console.error(`❌ ${file}`, err);
      fail++;
    }
  }

  console.log(`\n🎉 导入完成：${ok} 成功，${fail} 失败`);
  await db.$disconnect();
}

main().catch(console.error);
