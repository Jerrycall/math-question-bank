/**
 * 增量同步：本地 → Neon（目标库）
 *
 * - 题目：目标无此 id，或「slug/title/content/答案/解析/难度/来源等」与本地不一致时 upsert（不只靠 updatedAt）
 * - 标签：无 updatedAt 字段，在内存中比对字段，仅对变更/新增 upsert
 * - 题目-标签：比对本地与目标，仅对「打标不一致」的题目重写标签边；并与「正文有更新的题目」合并
 * - 题目关联：比对边集合，不一致则整表按本地重建（关联条数通常远小于题目）
 *
 * 用法：
 *   TARGET_DATABASE_URL="postgresql://..." npx ts-node --project tsconfig.scripts.json scripts/sync-db-to-neon-incremental.ts
 *
 * 可选环境变量：
 *   SYNC_FULL_JUNCTION=1   全量重同步 question_tags 与 question_relations（与旧版 sync-db 同量级，但更一致）
 *   SYNC_PRUNE_DELETED=1   删除「本地已不存在」的题目/标签/关联（危险，先备份）
 *   SYNC_DRY_RUN=1         只打印统计，不写库
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

const SOURCE_URL = process.env.DATABASE_URL?.trim() ?? "";
if (SOURCE_URL && TARGET_URL.trim() === SOURCE_URL) {
  console.error(
    "❌ DATABASE_URL 与 TARGET_DATABASE_URL 相同：增量会变成「自己和自己比」，题目内容永远不会更新。\n" +
      "请把 DATABASE_URL 指向本地 PostgreSQL，TARGET_DATABASE_URL 单独指向 Neon。"
  );
  process.exit(1);
}
if (!SOURCE_URL) {
  console.warn("⚠️ 未设置 DATABASE_URL，请确认 Prisma 能连上作为「源」的本地库。\n");
}

const FULL_JUNCTION = process.env.SYNC_FULL_JUNCTION === "1";
const PRUNE_DELETED = process.env.SYNC_PRUNE_DELETED === "1";
const DRY_RUN = process.env.SYNC_DRY_RUN === "1";

const sourceDb = new PrismaClient();
const targetDb = new PrismaClient({
  datasources: { db: { url: TARGET_URL } },
});

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

type TagRow = {
  id: string;
  name: string;
  slug: string;
  type: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  createdAt: Date;
};

function tagSignature(t: TagRow): string {
  return JSON.stringify({
    name: t.name,
    slug: t.slug,
    type: t.type,
    description: t.description,
    parentId: t.parentId,
    sortOrder: t.sortOrder,
  });
}

function groupTagsByQuestion(
  rows: { questionId: string; tagId: string }[]
): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const r of rows) {
    let s = m.get(r.questionId);
    if (!s) {
      s = new Set();
      m.set(r.questionId, s);
    }
    s.add(r.tagId);
  }
  return m;
}

function sortedTagKey(set: Set<string>): string {
  return Array.from(set).sort().join("\n");
}

function relationEdgeKey(r: {
  fromId: string;
  toId: string;
  relationType: string;
}): string {
  return `${r.fromId}\t${r.toId}\t${r.relationType}`;
}

/** 与 upsert 写入的字段一致，用于判断线上题目是否落后于本地 */
type QuestionSyncSnapshot = {
  slug: string;
  title: string;
  content: string;
  answer: string;
  analysis: string;
  difficulty: string;
  source: string | null;
  sourceYear: number | null;
  mdFilePath: string | null;
};

function questionSyncSignature(q: QuestionSyncSnapshot): string {
  return JSON.stringify({
    slug: q.slug,
    title: q.title,
    content: q.content,
    answer: q.answer,
    analysis: q.analysis,
    difficulty: q.difficulty,
    source: q.source,
    sourceYear: q.sourceYear,
    mdFilePath: q.mdFilePath,
  });
}

async function main() {
  if (DRY_RUN) {
    console.log("🔍 SYNC_DRY_RUN=1，仅统计，不写入目标库\n");
  }

  console.log("📤 从本地 / 目标读取元数据…");
  const [
    sourceTags,
    targetTagRows,
    sourceQuestions,
    sourceQuestionTags,
    sourceRelations,
    targetQuestionTags,
    targetRelations,
  ] = await Promise.all([
    sourceDb.tag.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    targetDb.tag.findMany(),
    sourceDb.question.findMany({ orderBy: { createdAt: "asc" } }),
    sourceDb.questionTag.findMany(),
    sourceDb.questionRelation.findMany(),
    targetDb.questionTag.findMany(),
    targetDb.questionRelation.findMany(),
  ]);

  const sourceIds = new Set(sourceQuestions.map((q) => q.id));
  const sourceIdList = sourceQuestions.map((q) => q.id);

  const targetQuestionSnapshots =
    sourceIdList.length === 0
      ? []
      : await targetDb.question.findMany({
          where: { id: { in: sourceIdList } },
          select: {
            id: true,
            slug: true,
            title: true,
            content: true,
            answer: true,
            analysis: true,
            difficulty: true,
            source: true,
            sourceYear: true,
            mdFilePath: true,
          },
        });

  const targetQuestionById = new Map(
    targetQuestionSnapshots.map((q) => [q.id, q])
  );

  const targetTagById = new Map(targetTagRows.map((t) => [t.id, t]));

  const modifiedQuestionIds = new Set<string>();
  let questionNewOnTarget = 0;
  let questionContentDrift = 0;
  for (const q of sourceQuestions) {
    const tg = targetQuestionById.get(q.id);
    if (!tg) {
      modifiedQuestionIds.add(q.id);
      questionNewOnTarget++;
    } else if (
      questionSyncSignature(q) !== questionSyncSignature(tg)
    ) {
      modifiedQuestionIds.add(q.id);
      questionContentDrift++;
    }
  }

  const tagsToUpsert = sourceTags.filter((t) => {
    const ex = targetTagById.get(t.id);
    if (!ex) return true;
    return tagSignature(t as TagRow) !== tagSignature(ex as TagRow);
  });

  const uniqueTagsToUpsert = sortTagsParentFirst(tagsToUpsert);

  const sourceQtByQ = groupTagsByQuestion(sourceQuestionTags);
  const targetQtByQ = groupTagsByQuestion(targetQuestionTags);
  const qtMismatchIds = new Set<string>();
  for (const q of sourceQuestions) {
    const qid = q.id;
    const a = sourceQtByQ.get(qid) ?? new Set<string>();
    const b = targetQtByQ.get(qid) ?? new Set<string>();
    if (sortedTagKey(a) !== sortedTagKey(b)) {
      qtMismatchIds.add(qid);
    }
  }

  const validSourceRels = sourceRelations.filter(
    (r) => sourceIds.has(r.fromId) && sourceIds.has(r.toId)
  );
  const targetRelComparable = targetRelations.filter(
    (r) => sourceIds.has(r.fromId) && sourceIds.has(r.toId)
  );
  const srcRelKeys = new Set(validSourceRels.map(relationEdgeKey));
  const tgtRelKeys = new Set(targetRelComparable.map(relationEdgeKey));
  let relationsNeedFull = false;
  if (srcRelKeys.size !== tgtRelKeys.size) {
    relationsNeedFull = true;
  } else {
    for (const k of Array.from(srcRelKeys)) {
      if (!tgtRelKeys.has(k)) {
        relationsNeedFull = true;
        break;
      }
    }
  }

  const touchQt = new Set<string>([
    ...Array.from(modifiedQuestionIds),
    ...Array.from(qtMismatchIds),
  ]);

  console.log(
    `  本地 标签 ${sourceTags.length}，题目 ${sourceQuestions.length}，` +
      `题目-标签 ${sourceQuestionTags.length}，关联 ${sourceRelations.length}`
  );
  console.log(
    `  本轮需 upsert 题目: ${modifiedQuestionIds.size}（其中目标无 id: ${questionNewOnTarget}，` +
      `内容/元数据不一致: ${questionContentDrift}），` +
      `打标与目标不一致的题目: ${qtMismatchIds.size}，` +
      `需重写题目-标签的题目数: ${touchQt.size}，` +
      `需 upsert 标签: ${uniqueTagsToUpsert.length}，` +
      (FULL_JUNCTION
        ? "关联表: 全量替换"
        : relationsNeedFull
          ? "关联表: 整表按本地对齐"
          : touchQt.size > 0
            ? "关联表: 仅涉及上述题目"
            : "关联表: 跳过")
  );

  if (sourceQuestions.length === 0 && FULL_JUNCTION) {
    console.error(
      "本地没有题目时不能使用 SYNC_FULL_JUNCTION=1（会清空目标库的题目-标签与关联）。"
    );
    process.exit(1);
  }

  if (sourceQuestions.length === 0) {
    console.log("本地没有题目：仅会同步变更的标签，不写入题目与关联表。");
  }

  if (DRY_RUN) {
    await sourceDb.$disconnect();
    await targetDb.$disconnect();
    console.log("\n（dry run 结束）");
    return;
  }

  console.log("\n📥 写入目标数据库…");

  for (const tag of uniqueTagsToUpsert) {
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
  console.log(`  ✅ 标签 upsert: ${uniqueTagsToUpsert.length}`);

  if (sourceQuestions.length === 0) {
    await sourceDb.$disconnect();
    await targetDb.$disconnect();
    console.log("\n🎉 增量同步完成（仅标签）。");
    return;
  }

  let questionUpserted = 0;
  for (const q of sourceQuestions) {
    if (!modifiedQuestionIds.has(q.id)) continue;
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
    questionUpserted++;
  }
  console.log(`  ✅ 题目 upsert: ${questionUpserted}`);

  const tagIds = new Set(sourceTags.map((t) => t.id));

  if (FULL_JUNCTION) {
    const validQT = sourceQuestionTags.filter(
      (qt) => sourceIds.has(qt.questionId) && tagIds.has(qt.tagId)
    );
    const validRel = sourceRelations.filter(
      (r) => sourceIds.has(r.fromId) && sourceIds.has(r.toId)
    );
    await targetDb.questionTag.deleteMany({});
    await targetDb.questionRelation.deleteMany({});
    for (let i = 0; i < validQT.length; i += 200) {
      const chunk = validQT.slice(i, i + 200);
      await targetDb.questionTag.createMany({
        data: chunk.map((qt) => ({
          questionId: qt.questionId,
          tagId: qt.tagId,
          createdAt: qt.createdAt,
        })),
        skipDuplicates: true,
      });
    }
    for (const r of validRel) {
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
    console.log(
      `  ✅ 题目-标签（全量替换）: ${validQT.length}，关联: ${validRel.length}`
    );
  } else {
    if (touchQt.size > 0) {
      const touchList = Array.from(touchQt);
      await targetDb.questionTag.deleteMany({
        where: { questionId: { in: touchList } },
      });
      const qtToAdd = sourceQuestionTags.filter(
        (qt) =>
          touchQt.has(qt.questionId) &&
          sourceIds.has(qt.questionId) &&
          tagIds.has(qt.tagId)
      );
      for (let i = 0; i < qtToAdd.length; i += 200) {
        const chunk = qtToAdd.slice(i, i + 200);
        await targetDb.questionTag.createMany({
          data: chunk.map((qt) => ({
            questionId: qt.questionId,
            tagId: qt.tagId,
            createdAt: qt.createdAt,
          })),
          skipDuplicates: true,
        });
      }
      console.log(`  ✅ 题目-标签（局部）: 写入 ${qtToAdd.length} 条边`);
    } else {
      console.log("  ⏭ 题目正文与打标均无差异，跳过题目-标签重写");
    }

    if (relationsNeedFull) {
      await targetDb.questionRelation.deleteMany({});
      for (const r of validSourceRels) {
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
      console.log(`  ✅ 题目关联（整表对齐）: ${validSourceRels.length}`);
    } else if (touchQt.size > 0) {
      const touchList = Array.from(touchQt);
      await targetDb.questionRelation.deleteMany({
        where: {
          OR: [{ fromId: { in: touchList } }, { toId: { in: touchList } }],
        },
      });
      const relToAdd = sourceRelations.filter(
        (r) =>
          sourceIds.has(r.fromId) &&
          sourceIds.has(r.toId) &&
          (touchQt.has(r.fromId) || touchQt.has(r.toId))
      );
      for (const r of relToAdd) {
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
      console.log(`  ✅ 题目关联（局部）: ${relToAdd.length}`);
    } else {
      console.log("  ⏭ 题目关联与本地一致，跳过");
    }
  }

  if (PRUNE_DELETED) {
    const targetAllQ = await targetDb.question.findMany({ select: { id: true } });
    const toDeleteQ = targetAllQ.filter((q) => !sourceIds.has(q.id)).map((q) => q.id);
    if (toDeleteQ.length) {
      await targetDb.question.deleteMany({ where: { id: { in: toDeleteQ } } });
      console.log(`  🗑 已删除目标库中本地不存在的题目: ${toDeleteQ.length}`);
    }
    const sourceTagIds = new Set(sourceTags.map((t) => t.id));
    const targetAllTags = await targetDb.tag.findMany({ select: { id: true } });
    const toDeleteTags = targetAllTags
      .filter((t) => !sourceTagIds.has(t.id))
      .map((t) => t.id);
    if (toDeleteTags.length) {
      await targetDb.tag.deleteMany({ where: { id: { in: toDeleteTags } } });
      console.log(`  🗑 已删除目标库中本地不存在的标签: ${toDeleteTags.length}`);
    }
  }

  await sourceDb.$disconnect();
  await targetDb.$disconnect();

  console.log("\n🎉 增量同步完成。");
  console.log(
    "\n提示：本地删除的题目/标签默认不会从线上删除；需要时请设 SYNC_PRUNE_DELETED=1（先备份）或运行 npm run sync-db 全量对齐。"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
