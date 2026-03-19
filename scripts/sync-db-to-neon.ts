/**
 * 将本地数据库中的题目、标签、题目-标签关联、题目关联 全量同步到 Neon（目标库）
 *
 * 用法：
 *   TARGET_DATABASE_URL="postgresql://..." npx ts-node --project tsconfig.scripts.json scripts/sync-db-to-neon.ts
 *
 * - 源库：当前 .env / .env.local 中的 DATABASE_URL（本地）
 * - 目标库：环境变量 TARGET_DATABASE_URL（Neon）
 */

import { PrismaClient } from "@prisma/client";
import {
  mergeTargetTagIdIntoCanonical,
  prepareTagUpsertConflictsOnTarget,
} from "./tag-slug-merge-on-target";

const TARGET_URL = process.env.TARGET_DATABASE_URL;
if (!TARGET_URL?.trim()) {
  console.error("请设置环境变量 TARGET_DATABASE_URL（Neon 连接串）");
  process.exit(1);
}

const sourceDb = new PrismaClient();
const targetDb = new PrismaClient({
  datasources: { db: { url: TARGET_URL } },
});

/** 标签按「父先子后」排序，保持完整类型 */
function sortTagsParentFirst<T extends { id: string; parentId: string | null }>(
  tags: T[]
): T[] {
  const result: T[] = [];
  const added = new Set<string>();

  while (result.length < tags.length) {
    let addedAny = false;
    for (const t of tags) {
      if (added.has(t.id)) continue;
      if (t.parentId == null || added.has(t.parentId)) {
        result.push(t);
        added.add(t.id);
        addedAny = true;
      }
    }
    if (!addedAny) break;
  }
  return result.length === tags.length ? result : tags;
}

async function main() {
  console.log("📤 从本地数据库读取…");
  const [tags, questions, questionTags, questionRelations] = await Promise.all([
    sourceDb.tag.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    sourceDb.question.findMany({ orderBy: { createdAt: "asc" } }),
    sourceDb.questionTag.findMany(),
    sourceDb.questionRelation.findMany(),
  ]);

  console.log(`  标签: ${tags.length}，题目: ${questions.length}，题目-标签: ${questionTags.length}，题目关联: ${questionRelations.length}`);

  if (questions.length === 0) {
    console.log("本地没有题目，无需同步。");
    await sourceDb.$disconnect();
    await targetDb.$disconnect();
    return;
  }

  console.log("\n📥 写入目标数据库（Neon）…");

  const tagOrder = sortTagsParentFirst(tags);
  for (const tag of tagOrder) {
    const mergeFromIds = await prepareTagUpsertConflictsOnTarget(targetDb, tag);
    await targetDb.tag.upsert({
      where: { id: tag.id },
      create: {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        type: tag.type,
        description: tag.description,
        parentId: tag.parentId,
        sortOrder: tag.sortOrder,
        createdAt: tag.createdAt,
      },
      update: {
        name: tag.name,
        slug: tag.slug,
        type: tag.type,
        description: tag.description,
        parentId: tag.parentId,
        sortOrder: tag.sortOrder,
      },
    });
    for (const mergeFromId of mergeFromIds) {
      await mergeTargetTagIdIntoCanonical(targetDb, mergeFromId, tag.id);
    }
  }
  console.log(`  ✅ 标签: ${tags.length}`);

  for (const q of questions) {
    await targetDb.question.upsert({
      where: { id: q.id },
      create: {
        id: q.id,
        slug: q.slug,
        title: q.title,
        content: q.content,
        answer: q.answer,
        analysis: q.analysis,
        difficulty: q.difficulty,
        source: q.source,
        sourceYear: q.sourceYear,
        mdFilePath: q.mdFilePath,
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
      },
      update: {
        slug: q.slug,
        title: q.title,
        content: q.content,
        answer: q.answer,
        analysis: q.analysis,
        difficulty: q.difficulty,
        source: q.source,
        sourceYear: q.sourceYear,
        mdFilePath: q.mdFilePath,
        updatedAt: q.updatedAt,
      },
    });
  }
  console.log(`  ✅ 题目: ${questions.length}`);

  const questionIds = new Set(questions.map((q) => q.id));
  const tagIds = new Set(tags.map((t) => t.id));
  const validQuestionTags = questionTags.filter(
    (qt) => questionIds.has(qt.questionId) && tagIds.has(qt.tagId)
  );

  for (const qt of validQuestionTags) {
    await targetDb.questionTag.upsert({
      where: {
        questionId_tagId: { questionId: qt.questionId, tagId: qt.tagId },
      },
      create: {
        questionId: qt.questionId,
        tagId: qt.tagId,
        createdAt: qt.createdAt,
      },
      update: {},
    });
  }
  console.log(`  ✅ 题目-标签: ${validQuestionTags.length}`);

  const validRelations = questionRelations.filter(
    (r) => questionIds.has(r.fromId) && questionIds.has(r.toId)
  );
  for (const r of validRelations) {
    await targetDb.questionRelation.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        fromId: r.fromId,
        toId: r.toId,
        relationType: r.relationType,
      },
      update: {
        fromId: r.fromId,
        toId: r.toId,
        relationType: r.relationType,
      },
    });
  }
  console.log(`  ✅ 题目关联: ${validRelations.length}`);

  await sourceDb.$disconnect();
  await targetDb.$disconnect();
  console.log("\n🎉 同步完成，Neon 上题目与标签已与本地一致。");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
