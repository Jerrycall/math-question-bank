/**
 * 从流墨轩「上海高三复习题集」的 _标签-* 目录导入/更新网站标签（知识点、思想、来源、方法）
 *
 * 运行（默认路径为下方 ROOT，可通过环境变量覆盖）：
 *   npx ts-node --project tsconfig.scripts.json scripts/import-shanghai-tags.ts
 *
 *   SHANGHAI_TAGS_ROOT=/path/to/上海高三复习题集 DATABASE_URL=... npm run import-shanghai-tags
 */

import { PrismaClient, TagType } from "@prisma/client";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";
import matter from "gray-matter";

const db = new PrismaClient();

const DEFAULT_ROOT =
  "/Users/zhouzhijie/cursor/流墨轩·AI教研 - 新教研员/数学-高中知识库/03-练习题库/上海高三复习题集";

const ROOT = process.env.SHANGHAI_TAGS_ROOT || DEFAULT_ROOT;

const FOLDERS: { subdir: string; type: TagType; label: string }[] = [
  { subdir: "_标签-知识点", type: "KNOWLEDGE", label: "知识点" },
  { subdir: "_标签-思想", type: "THOUGHT", label: "思想" },
  { subdir: "_标签-来源", type: "SOURCE", label: "来源" },
  { subdir: "_标签-方法", type: "METHOD", label: "方法" },
];

function slugify(name: string): string {
  const s = name
    .replace(/\s+/g, "-")
    .replace(/[^\w\-\u4e00-\u9fa5]/g, "")
    .replace(/\-+/g, "-")
    .trim()
    .toLowerCase();
  return s || "tag";
}

/**
 * 从 Obsidian 标签页解析展示名与说明（支持 YAML frontmatter 里「标签名」；去掉 dataview）
 */
function parseTagMarkdown(rawFile: string, fileStem: string): {
  name: string;
  description: string | null;
} {
  const { data: fm, content: bodyAfterFm } = matter(rawFile);
  const fromFm =
    typeof fm["标签名"] === "string" ? String(fm["标签名"]).trim() : "";

  const content = bodyAfterFm;
  const lines = content.split(/\r?\n/);
  let name = fileStem.trim() || "未命名";

  if (fromFm) {
    name = fromFm;
  } else {
    const firstHeading = lines.find((l) => /^\s*#+\s+/.test(l));
    if (firstHeading) {
      const raw = firstHeading.replace(/^\s*#+\s*/, "").trim();
      const stripped = raw
        .replace(/^(知识点|思想|方法|来源)[：:]\s*/i, "")
        .trim();
      if (stripped) name = stripped;
      else if (raw) name = raw;
    }
  }

  let body = content.replace(/```dataview[\s\S]*?```/gi, "").trim();
  body = body.replace(/^\s*#+\s+.*$/m, "").trim();
  const description = body.length > 0 ? body.slice(0, 8000) : null;

  return { name, description };
}

async function upsertTag(
  name: string,
  type: TagType,
  description: string | null,
  sortOrder: number
): Promise<void> {
  const existing = await db.tag.findFirst({
    where: { name, type },
  });

  if (existing) {
    await db.tag.update({
      where: { id: existing.id },
      data: {
        description: description ?? existing.description,
        sortOrder,
      },
    });
    return;
  }

  let slug = slugify(name);
  const slugTaken = await db.tag.findUnique({ where: { slug } });
  if (slugTaken) {
    slug = `${slugify(name)}-${type.toLowerCase()}`.slice(0, 120);
    const again = await db.tag.findUnique({ where: { slug } });
    if (again) {
      slug = `${slugify(name)}-${type.toLowerCase()}-${Date.now()}`.slice(0, 120);
    }
  }

  await db.tag.create({
    data: {
      name,
      slug,
      type,
      description,
      sortOrder,
    },
  });
}

async function importFolder(
  absPath: string,
  type: TagType,
  label: string
): Promise<{ ok: number; skip: number }> {
  if (!existsSync(absPath)) {
    console.warn(`⚠️  跳过（目录不存在）：${absPath}`);
    return { ok: 0, skip: 0 };
  }

  const files = readdirSync(absPath)
    .filter((f) => f.endsWith(".md"))
    .sort((a, b) => a.localeCompare(b, "zh-CN"));

  let ok = 0;
  for (let i = 0; i < files.length; i++) {
    const fp = join(absPath, files[i]);
    const stem = files[i].replace(/\.md$/i, "");
    try {
      const raw = readFileSync(fp, "utf-8");
      const { name, description } = parseTagMarkdown(raw, stem);
      await upsertTag(name, type, description, (i + 1) * 10);
      ok++;
      console.log(`  ✅ [${label}] ${name}`);
    } catch (e) {
      console.error(`  ❌ [${label}] ${fp}`, e);
    }
  }
  return { ok, skip: 0 };
}

async function main() {
  console.log(`📂 标签根目录：${ROOT}\n`);

  if (!existsSync(ROOT)) {
    console.error(
      "根目录不存在。请设置 SHANGHAI_TAGS_ROOT 指向「上海高三复习题集」文件夹。"
    );
    process.exit(1);
  }

  let total = 0;
  for (const { subdir, type, label } of FOLDERS) {
    const dir = join(ROOT, subdir);
    console.log(`\n── ${label}（${subdir}）──`);
    const { ok } = await importFolder(dir, type, label);
    total += ok;
  }

  console.log(`\n🎉 标签处理完成，共写入/更新 ${total} 条（按 name+type 匹配更新说明与排序）`);
  await db.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
