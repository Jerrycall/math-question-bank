/**
 * 知识点层级结构：一级分类 + 现有知识点归入对应二级目录
 * 运行：npx ts-node --project tsconfig.scripts.json scripts/seed-knowledge-structure.ts
 */

import { PrismaClient, TagType } from "@prisma/client";

const db = new PrismaClient();

// 一级分类（顺序即 sortOrder；匹配时按顺序取第一个命中，故「三角」「导数」放在「函数」前）
const TOP_LEVEL: { name: string; keywords: string[] }[] = [
  { name: "集合", keywords: ["集合"] },
  { name: "命题与逻辑", keywords: ["命题", "逻辑", "充分", "必要", "条件", "全称", "存在", "或", "且", "非"] },
  { name: "不等式", keywords: ["不等式"] },
  { name: "三角", keywords: ["三角", "正弦", "余弦", "正切", "诱导", "恒等", "解三角形"] },
  { name: "向量", keywords: ["向量"] },
  { name: "复数", keywords: ["复数"] },
  { name: "数列", keywords: ["数列", "等差", "等比", "递推", "求和"] },
  { name: "立体几何", keywords: ["立体", "空间", "球", "柱", "锥", "三视图", "线面", "面面"] },
  { name: "解析几何", keywords: ["解析", "直线", "圆", "椭圆", "双曲线", "抛物线", "圆锥曲线", "坐标", "交点"] },
  { name: "导数", keywords: ["导数", "导", "极值", "切线"] },
  { name: "积分", keywords: ["积分", "定积分", "不定积分"] },
  { name: "函数", keywords: ["函数", "指数", "对数", "幂", "单调性", "奇偶", "周期", "反函数", "零点"] },
  { name: "概率统计", keywords: ["概率", "统计", "分布", "抽样", "期望", "方差"] },
];

// 强制归属：名称完全匹配时优先归入指定一级（避免关键词误判）
const FORCE_CATEGORY_BY_NAME: Record<string, string> = {
  "零点问题": "函数",
  "直线与圆锥曲线交点": "解析几何",
};

function slugify(name: string): string {
  return name
    .replace(/\s+/g, "-")
    .replace(/[^\w\-\u4e00-\u9fa5]/g, "")
    .replace(/\-\-+/g, "-")
    .trim()
    .toLowerCase() || "tag";
}

function matchCategory(name: string): number {
  const n = name.trim();
  const forced = FORCE_CATEGORY_BY_NAME[n];
  if (forced) {
    const idx = TOP_LEVEL.findIndex((t) => t.name === forced);
    if (idx >= 0) return idx;
  }
  for (let i = 0; i < TOP_LEVEL.length; i++) {
    for (const kw of TOP_LEVEL[i].keywords) {
      if (n.includes(kw)) return i;
    }
  }
  return -1;
}

async function main() {
  console.log(`📂 建立知识点一级分类（${TOP_LEVEL.length} 类）并归入现有知识点…\n`);

  const topNames = new Set(TOP_LEVEL.map((t) => t.name));
  const categoryIds: string[] = [];

  for (let i = 0; i < TOP_LEVEL.length; i++) {
    const { name } = TOP_LEVEL[i];
    const baseSlug = slugify(name);
    const existing = await db.tag.findFirst({
      where: { name, type: TagType.KNOWLEDGE },
    });
    if (existing) {
      await db.tag.update({
        where: { id: existing.id },
        data: { parentId: null, sortOrder: i },
      });
      categoryIds[i] = existing.id;
      console.log(`  ✓ 一级：${name}（已存在，已设为根并排序）`);
    } else {
      let slug = baseSlug;
      let n = 0;
      while (await db.tag.findUnique({ where: { slug } })) {
        slug = `${baseSlug}-${++n}`;
      }
      const created = await db.tag.create({
        data: { name, slug, type: TagType.KNOWLEDGE, sortOrder: i },
      });
      categoryIds[i] = created.id;
      console.log(`  ✓ 一级：${name}（新建）`);
    }
  }

  const knowledgeTags = await db.tag.findMany({
    where: { type: TagType.KNOWLEDGE },
  });

  let assigned = 0;
  let skipped = 0;
  for (const tag of knowledgeTags) {
    if (topNames.has(tag.name)) continue;
    const idx = matchCategory(tag.name);
    if (idx >= 0 && categoryIds[idx]) {
      await db.tag.update({
        where: { id: tag.id },
        data: { parentId: categoryIds[idx] },
      });
      assigned++;
      console.log(`  → 二级：${tag.name} → ${TOP_LEVEL[idx].name}`);
    } else {
      skipped++;
    }
  }

  console.log(`\n🎉 完成：${TOP_LEVEL.length} 个一级分类已就绪，${assigned} 个知识点已归入二级，${skipped} 个未匹配（可后续手动归类）。`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
