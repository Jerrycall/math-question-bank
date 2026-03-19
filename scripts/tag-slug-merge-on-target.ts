import type { PrismaClient, TagType } from "@prisma/client";

/**
 * 将目标库上 oldId 标签的关联并入 canonicalId，再删除 oldId。
 * 调用前需保证 canonicalId 对应行已存在（且 slug 等已写好）。
 */
export async function mergeTargetTagIdIntoCanonical(
  db: PrismaClient,
  oldId: string,
  canonicalId: string
) {
  if (oldId === canonicalId) return;

  await db.tag.updateMany({
    where: { parentId: oldId },
    data: { parentId: canonicalId },
  });

  const qts = await db.questionTag.findMany({ where: { tagId: oldId } });
  for (const qt of qts) {
    const exists = await db.questionTag.findUnique({
      where: {
        questionId_tagId: { questionId: qt.questionId, tagId: canonicalId },
      },
    });
    if (exists) {
      await db.questionTag.delete({
        where: {
          questionId_tagId: { questionId: qt.questionId, tagId: oldId },
        },
      });
    } else {
      await db.questionTag.update({
        where: {
          questionId_tagId: { questionId: qt.questionId, tagId: oldId },
        },
        data: { tagId: canonicalId },
      });
    }
  }

  const kms = await db.knowledgeMastery.findMany({ where: { tagId: oldId } });
  for (const km of kms) {
    const exists = await db.knowledgeMastery.findUnique({
      where: {
        accountId_tagId: { accountId: km.accountId, tagId: canonicalId },
      },
    });
    if (exists) {
      await db.knowledgeMastery.delete({ where: { id: km.id } });
    } else {
      await db.knowledgeMastery.update({
        where: { id: km.id },
        data: { tagId: canonicalId },
      });
    }
  }

  await db.tag.delete({ where: { id: oldId } });
}

export type TagUpsertConflictCheck = {
  id: string;
  name: string;
  slug: string;
  type: TagType;
};

/**
 * 目标库上若另有行占用同一 slug 或同一 (name, type)，upsert 会撞 P2002。
 * 对每条冲突行同时改掉 slug 与 name，一次性解除两个唯一约束，再在 upsert 后 merge。
 */
export async function prepareTagUpsertConflictsOnTarget(
  db: PrismaClient,
  tag: TagUpsertConflictCheck
): Promise<string[]> {
  const conflictingIds = new Set<string>();

  const bySlug = await db.tag.findUnique({ where: { slug: tag.slug } });
  if (bySlug && bySlug.id !== tag.id) {
    conflictingIds.add(bySlug.id);
  }

  const byNameType = await db.tag.findFirst({
    where: {
      name: tag.name,
      type: tag.type,
      id: { not: tag.id },
    },
  });
  if (byNameType) {
    conflictingIds.add(byNameType.id);
  }

  const mergeList: string[] = [];
  for (const cid of conflictingIds) {
    const row = await db.tag.findUnique({ where: { id: cid } });
    if (!row || row.id === tag.id) continue;
    const stamp = `${Date.now()}_${cid.slice(0, 8)}`;
    const tmpSlug = `__sync_tmp_slug__${stamp}`;
    const tmpName = `__sync_tmp_name__${stamp}`;
    console.log(
      `  ⚠️ 目标库 id ${cid} 与本地 id ${tag.id} 在 slug 和/或 (名称+类型) 上冲突，` +
        `已写入临时 slug/name，本标签 upsert 后将合并关联并删除该行…`
    );
    await db.tag.update({
      where: { id: cid },
      data: { slug: tmpSlug, name: tmpName },
    });
    mergeList.push(cid);
  }

  return mergeList;
}
