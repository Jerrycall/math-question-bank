/**
 * 为已有题目补打「{年份}年」来源标签（与 import-shanghai 行为一致）。
 * 仅处理 sourceYear 非空且尚未关联该标签的题目。
 *
 *   npm run backfill-source-year-tags
 *   DATABASE_URL="..." npm run backfill-source-year-tags
 */

import { PrismaClient, TagType } from "@prisma/client";

const db = new PrismaClient();

function slugify(name: string): string {
  return (
    name
      .replace(/\s+/g, "-")
      .replace(/[^\w\-\u4e00-\u9fa5]/g, "")
      .replace(/\-\-+/g, "-")
      .trim()
      .toLowerCase() || "tag"
  );
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

async function main() {
  const questions = await db.question.findMany({
    where: { sourceYear: { not: null } },
    select: {
      id: true,
      sourceYear: true,
      tags: { select: { tagId: true } },
    },
  });

  let updated = 0;
  let skipped = 0;

  for (const q of questions) {
    const y = q.sourceYear;
    if (y == null || y < 1900 || y > 2100) {
      skipped++;
      continue;
    }
    const label = `${y}年`;
    const tagId = await getOrCreateTag(label, "SOURCE");
    const has = q.tags.some((t) => t.tagId === tagId);
    if (has) {
      skipped++;
      continue;
    }
    await db.questionTag.create({
      data: { questionId: q.id, tagId },
    });
    updated++;
  }

  console.log(`✅ 补打来源标签「{年}年」完成：新增关联 ${updated} 条，跳过 ${skipped} 条`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
