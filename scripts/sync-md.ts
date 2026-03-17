/**
 * Markdown 题目文件 → 数据库同步脚本
 * 运行：npm run sync-md
 */

import { PrismaClient, Difficulty, TagType } from "@prisma/client";
import { join } from "path";
import { parseQuestionFile, getAllQuestionFiles } from "../src/lib/markdown/parser";

const db = new PrismaClient();

const DIFFICULTY_MAP: Record<number, Difficulty> = {
  1: "EASY",
  2: "MEDIUM_LOW",
  3: "MEDIUM",
  4: "MEDIUM_HIGH",
  5: "HARD",
};

const TAG_TYPE_MAP: Record<string, TagType> = {
  knowledge: "KNOWLEDGE",
  method: "METHOD",
  thought: "THOUGHT",
  source: "SOURCE",
};

async function getOrCreateTag(
  name: string,
  type: TagType
): Promise<string> {
  const slug = name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-\u4e00-\u9fa5]/g, "");

  const tag = await db.tag.upsert({
    where: { slug },
    create: { name, slug, type },
    update: {},
  });
  return tag.id;
}

async function syncQuestion(filePath: string): Promise<void> {
  const parsed = parseQuestionFile(filePath);
  const { frontmatter, question, answer, analysis } = parsed;

  if (!frontmatter.slug || !frontmatter.title) {
    console.warn(`跳过文件（缺少 slug 或 title）：${filePath}`);
    return;
  }

  const difficulty = DIFFICULTY_MAP[frontmatter.difficulty] ?? "MEDIUM";

  // 收集所有标签 ID
  const tagIds: string[] = [];
  for (const [typeKey, tagNames] of Object.entries(frontmatter.tags ?? {})) {
    const tagType = TAG_TYPE_MAP[typeKey];
    if (!tagType || !Array.isArray(tagNames)) continue;

    for (const name of tagNames) {
      const tagId = await getOrCreateTag(name, tagType);
      tagIds.push(tagId);
    }
  }

  // 如果有 source，创建来源标签
  if (frontmatter.source) {
    const sourceTagId = await getOrCreateTag(
      frontmatter.source,
      "SOURCE"
    );
    if (!tagIds.includes(sourceTagId)) {
      tagIds.push(sourceTagId);
    }
  }

  // 创建或更新题目
  await db.question.upsert({
    where: { slug: frontmatter.slug },
    create: {
      slug: frontmatter.slug,
      title: frontmatter.title,
      content: question || parsed.content,
      answer,
      analysis,
      difficulty,
      source: frontmatter.source,
      sourceYear: frontmatter.sourceYear,
      mdFilePath: filePath,
      tags: {
        create: tagIds.map((tagId) => ({ tagId })),
      },
    },
    update: {
      title: frontmatter.title,
      content: question || parsed.content,
      answer,
      analysis,
      difficulty,
      source: frontmatter.source,
      sourceYear: frontmatter.sourceYear,
      mdFilePath: filePath,
      tags: {
        deleteMany: {},
        create: tagIds.map((tagId) => ({ tagId })),
      },
    },
  });

  console.log(`✅ 同步成功：${frontmatter.slug} - ${frontmatter.title}`);
}

async function main() {
  const questionsDir = join(process.cwd(), "questions");
  console.log(`📂 扫描目录：${questionsDir}`);

  const files = getAllQuestionFiles(questionsDir);
  console.log(`📝 找到 ${files.length} 个 Markdown 文件\n`);

  let success = 0;
  let failed = 0;

  for (const file of files) {
    try {
      await syncQuestion(file);
      success++;
    } catch (err) {
      console.error(`❌ 同步失败：${file}`, err);
      failed++;
    }
  }

  console.log(`\n🎉 同步完成：${success} 成功，${failed} 失败`);
  await db.$disconnect();
}

main().catch(console.error);
