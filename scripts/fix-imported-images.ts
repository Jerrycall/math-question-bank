/**
 * 批量导入题目中的图片：从源 Markdown 所在目录拷贝图片到 public/uploads，并更新题目内容中的路径
 * 适用于已通过 import-shanghai 导入、题目内容里含相对路径图片的情况。
 *
 * 运行（需先配置好 DATABASE_URL）：
 *   npx ts-node --project tsconfig.scripts.json scripts/fix-imported-images.ts
 *
 * 可选环境变量：
 *   SHANGHAI_QUESTIONS_DIR  源题目库目录（与 import-shanghai 一致；当前脚本以库中 mdFilePath 为准）
 *   VAULT_ROOT             图片所在根目录（默认：流墨轩·AI教研 - 新教研员 文件夹）
 */

import { PrismaClient } from "@prisma/client";
import { existsSync, copyFileSync, mkdirSync, readdirSync } from "fs";
import { join, dirname, resolve } from "path";

const db = new PrismaClient();

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");
const SOURCE_DIR =
  process.env.SHANGHAI_QUESTIONS_DIR ||
  "/Users/zhouzhijie/cursor/流墨轩·AI教研 - 新教研员/数学-高中知识库/03-练习题库/上海高三复习题集/题目库";
// 流墨轩根目录：图片若统一放在该文件夹（或其 assets/附件 子目录）下，会从这里查找
const VAULT_ROOT =
  process.env.VAULT_ROOT || "/Users/zhouzhijie/cursor/流墨轩·AI教研 - 新教研员";

// 匹配 Markdown 图片：![alt](url)
const IMG_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;
// 匹配 HTML 图片：<img src="url" ...> 或 <img ... src="url" ...>
const IMG_HTML_REGEX = /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi;
// 匹配 Obsidian/双链 图片：![[path]] 或 ! [[path]] 或 ![[path|alt]]（! 后可有空格）
const IMG_WIKI_REGEX = /!\s*\[\[([^\]]+)\]\]/g;

function isRelativePath(href: string): boolean {
  const t = href.trim();
  return t.length > 0 && !/^https?:\/\//i.test(t) && !t.startsWith("/") && !t.startsWith("file:");
}

// 从 ![[path]] 或 ![[path|alt]] 中取出用于解析文件的 path 部分
function wikiPathPart(inner: string): string {
  const t = inner.trim();
  const i = t.indexOf("|");
  return i >= 0 ? t.slice(0, i).trim() : t;
}

function extractImageSrcs(text: string): string[] {
  const srcs: string[] = [];
  let m: RegExpExecArray | null;
  IMG_REGEX.lastIndex = 0;
  while ((m = IMG_REGEX.exec(text)) !== null) {
    srcs.push(m[2].trim());
  }
  IMG_HTML_REGEX.lastIndex = 0;
  while ((m = IMG_HTML_REGEX.exec(text)) !== null) {
    srcs.push(m[1].trim());
  }
  IMG_WIKI_REGEX.lastIndex = 0;
  while ((m = IMG_WIKI_REGEX.exec(text)) !== null) {
    srcs.push(wikiPathPart(m[1]));
  }
  return srcs;
}

function replaceImageInText(
  text: string,
  map: Map<string, string>
): string {
  let out = text.replace(IMG_REGEX, (full, alt: string, url: string) => {
    const u = url.trim();
    const newSrc = map.get(u);
    if (newSrc != null) return `![${alt}](${newSrc})`;
    return full;
  });
  out = out.replace(IMG_HTML_REGEX, (full) => {
    const m = full.match(/src\s*=\s*["']([^"']+)["']/i);
    if (!m) return full;
    const u = m[1].trim();
    const newSrc = map.get(u);
    if (newSrc != null) return full.replace(m[0], `src="${newSrc}"`);
    return full;
  });
  out = out.replace(IMG_WIKI_REGEX, (full, inner: string) => {
    const pathPart = wikiPathPart(inner);
    const newSrc = map.get(pathPart);
    if (newSrc != null) {
      const alt = inner.includes("|") ? inner.slice(inner.indexOf("|") + 1).trim() : "";
      return alt ? `![${alt}](${newSrc})` : `![](${newSrc})`;
    }
    return full;
  });
  return out;
}

function safeUploadFilename(slug: string, index: number, ext: string): string {
  const base = slug.replace(/^shanghai-/, "").replace(/[^\w\-]/g, "-");
  return `${base}-${index}${ext}`;
}

// 依次在「同目录、各上级、以及 VAULT_ROOT（流墨轩根目录）」下查找，返回首个存在的绝对路径
function resolveImagePath(baseDir: string, rel: string): string | null {
  const parent = dirname(baseDir);
  const grandParent = dirname(parent);
  const candidates = [
    join(baseDir, rel),
    join(baseDir, "assets", rel),
    join(baseDir, "附件", rel),
    join(baseDir, "images", rel),
    join(baseDir, "图", rel),
    join(baseDir, "Pasted", rel),
    join(baseDir, "粘贴", rel),
    join(parent, "assets", rel),
    join(parent, "附件", rel),
    join(parent, "images", rel),
    join(parent, "Pasted", rel),
    join(grandParent, "assets", rel),
    join(grandParent, "附件", rel),
    join(VAULT_ROOT, rel),
    join(VAULT_ROOT, "assets", rel),
    join(VAULT_ROOT, "附件", rel),
    join(VAULT_ROOT, "images", rel),
    join(VAULT_ROOT, "Pasted", rel),
    join(VAULT_ROOT, "粘贴", rel),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  // 若仍未找到，在流墨轩根目录下按文件名递归查找（适配 Obsidian 粘贴图等任意子目录）
  if (VAULT_ROOT && rel && (rel.includes("Pasted") || rel.includes("粘贴") || /\.(png|jpg|jpeg|gif|webp)$/i.test(rel))) {
    const found = findFileUnderDir(VAULT_ROOT, rel);
    if (found) return found;
  }
  return null;
}

function findFileUnderDir(dir: string, filename: string): string | null {
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = join(dir, e.name);
      if (e.isFile() && e.name === filename) return full;
      if (e.isDirectory() && !e.name.startsWith(".") && e.name !== "node_modules") {
        const found = findFileUnderDir(full, filename);
        if (found) return found;
      }
    }
  } catch (_) {
    // 忽略无权限等
  }
  return null;
}

async function main() {
  mkdirSync(UPLOAD_DIR, { recursive: true });

  const questions = await db.question.findMany({
    where: { mdFilePath: { not: null } },
    select: { id: true, slug: true, content: true, answer: true, analysis: true, mdFilePath: true },
  });

  if (questions.length === 0) {
    console.log("未找到带 mdFilePath 的题目（仅处理通过 import-shanghai 导入且保留源路径的题目）。");
    await db.$disconnect();
    return;
  }

  const DEBUG = process.env.DEBUG === "1" || process.env.VERBOSE === "1";
  console.log(`📂 共 ${questions.length} 道题目可能含图片，开始处理…\n`);

  let totalCopied = 0;
  let totalUpdated = 0;
  let withAnyImg = 0;
  let withRelativeImg = 0;
  let debugLogged = 0;

  for (const q of questions) {
    const mdPath = q.mdFilePath as string;
    const baseDir = dirname(mdPath);
    const allText = [q.content, q.answer, q.analysis].join("\n");
    const srcs = extractImageSrcs(allText);
    if (srcs.length > 0) withAnyImg++;
    const relativeSrcs = Array.from(new Set(srcs)).filter(isRelativePath);
    if (relativeSrcs.length > 0) withRelativeImg++;
    if (DEBUG && relativeSrcs.length > 0 && debugLogged < 3) {
      console.log(`  [诊断] ${q.slug} 基目录: ${dirname(mdPath)}`);
      for (const rel of relativeSrcs) {
        const absPath = resolve(dirname(mdPath), rel);
        console.log(`    - "${rel}" → 存在: ${existsSync(absPath)} (${absPath})`);
      }
      debugLogged++;
    }
    if (relativeSrcs.length === 0) continue;

    const replacements: { oldSrc: string; newSrc: string }[] = [];
    let index = 0;
    for (const rel of relativeSrcs) {
      const absPath = resolveImagePath(baseDir, rel);
      if (!absPath) {
        console.warn(`  跳过（文件不存在）：${rel}（已尝试同目录、assets、附件、images 等）`);
        continue;
      }
      const ext = rel.includes(".") ? rel.slice(rel.lastIndexOf(".")) : ".png";
      const filename = safeUploadFilename(q.slug, index, ext);
      copyFileSync(absPath, join(UPLOAD_DIR, filename));
      replacements.push({ oldSrc: rel, newSrc: `/uploads/${filename}` });
      totalCopied++;
      index++;
    }

    if (replacements.length === 0) continue;

    const srcToUrl = new Map(replacements.map((r) => [r.oldSrc, r.newSrc]));
    const content = replaceImageInText(q.content, srcToUrl);
    const answer = replaceImageInText(q.answer, srcToUrl);
    const analysis = replaceImageInText(q.analysis, srcToUrl);

    await db.question.update({
      where: { id: q.id },
      data: { content, answer, analysis },
    });
    totalUpdated++;
    console.log(`  ✅ ${q.slug}：${replacements.length} 张图片 → public/uploads`);
  }

  if (DEBUG || totalCopied === 0) {
    console.log(
      `\n📊 统计：${questions.length} 道题中，含任意图片引用 ${withAnyImg} 道，含相对路径图片 ${withRelativeImg} 道。`
    );
  }

  // 若未发现任何图片引用，采样题目内容，便于确认实际存储格式
  if (totalCopied === 0 && withAnyImg === 0 && questions.length > 0) {
    const suspect = /\.(png|jpg|jpeg|gif|webp)|!\[|<\/?img|\[.*\]\(.*\)/i;
    let sampled = false;
    for (const q of questions) {
      const all = q.content + "\n" + q.answer + "\n" + q.analysis;
      const idx = all.search(suspect);
      if (idx !== -1) {
        const start = Math.max(0, idx - 80);
        const snippet = all.slice(start, idx + 200).replace(/\n/g, "↵");
        console.log(`\n📄 采样（${q.slug}）可能含图片的片段：\n  …${snippet}…`);
        sampled = true;
        break;
      }
    }
    if (!sampled) {
      const q = questions[0];
      const preview = (q.content || "").slice(0, 400).replace(/\n/g, "↵");
      console.log(`\n📄 未检测到图片语法，首题（${q.slug}）内容前 400 字：\n  ${preview}…`);
    }
  }

  console.log(`\n🎉 完成：${totalCopied} 张图片已拷贝，${totalUpdated} 道题目已更新。`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
