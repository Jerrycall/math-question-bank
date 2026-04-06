/**
 * 将 public/uploads 下已引用的图片批量上传到 Vercel Blob，并把题目中的 /uploads/xxx 替换为 Blob 公网 URL。
 * 与线上 POST /api/upload/image 在设置 BLOB_READ_WRITE_TOKEN 时的行为一致。
 *
 * 前置：
 *   - 环境变量 BLOB_READ_WRITE_TOKEN（Vercel 项目 → Storage → Blob → .env.local 中 READ_WRITE_TOKEN）
 *   - DATABASE_URL：要更新链接的库（一般为本地，之后可再 sync-db:incremental）
 *
 * 用法：
 *   BLOB_READ_WRITE_TOKEN="vercel_blob_..." npm run upload-blob
 *   DRY_RUN=1 npm run upload-blob   # 只打印将上传的文件与将更新的题目数，不写 Blob、不改库
 */

import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";
import { put } from "@vercel/blob";
import { PrismaClient } from "@prisma/client";

function loadEnvFilesFromProjectRoot(): void {
  const merged: Record<string, string> = {};
  for (const name of [".env", ".env.local"]) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      merged[key] = val;
    }
  }
  for (const [key, val] of Object.entries(merged)) {
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnvFilesFromProjectRoot();

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN?.trim();
const DRY = process.env.DRY_RUN === "1";
const UPLOAD_DIR = join(process.cwd(), "public", "uploads");

// 捕获正文中的 /uploads/ 路径（文件名可含 URL 编码）
const UPLOAD_PATH_RE = /\/uploads\/([^)\s"'<>]+)/g;

function collectUploadPaths(text: string): Set<string> {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(UPLOAD_PATH_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    try {
      set.add(decodeURIComponent(m[1]));
    } catch {
      set.add(m[1]);
    }
  }
  return set;
}

function replaceUploadUrls(
  text: string,
  pairs: [string, string][]
): { next: string; changed: boolean } {
  let next = text;
  let changed = false;
  for (const [oldPath, newUrl] of pairs) {
    if (!next.includes(oldPath)) continue;
    const parts = next.split(oldPath);
    if (parts.length > 1) {
      next = parts.join(newUrl);
      changed = true;
    }
  }
  return { next, changed };
}

async function main() {
  if (!TOKEN) {
    console.error(
      "❌ 未设置 BLOB_READ_WRITE_TOKEN。\n" +
        "在 Vercel 项目 → Storage → 你的 Blob → 查看「环境变量示例」中的 READ_WRITE_TOKEN，\n" +
        "本地可写入 .env.local：BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...\n"
    );
    process.exit(1);
  }

  if (!existsSync(UPLOAD_DIR)) {
    console.error(`❌ 目录不存在：${UPLOAD_DIR}`);
    process.exit(1);
  }

  const db = new PrismaClient();

  const questions = await db.question.findMany({
    select: {
      id: true,
      slug: true,
      content: true,
      answer: true,
      analysis: true,
    },
  });

  const neededNames = new Set<string>();
  for (const q of questions) {
    const blob = [q.content, q.answer, q.analysis].join("\n");
    for (const name of collectUploadPaths(blob)) {
      neededNames.add(name);
    }
  }

  if (neededNames.size === 0) {
    console.log("题库中未出现 /uploads/ 引用，无需处理。");
    await db.$disconnect();
    return;
  }

  const pathToBlobUrl = new Map<string, string>();
  let filesUploaded = 0;

  console.log(`📤 ${DRY ? "[Dry run] " : ""}将处理 ${neededNames.size} 个 distinct 路径（以库中出现的 /uploads/ 为准）\n`);

  for (const name of neededNames) {
    const safeName = name.replace(/^\/+/, "").replace(/\.\.(\/|\\)/g, "");
    const localPath = join(UPLOAD_DIR, safeName);
    if (!existsSync(localPath)) {
      console.warn(`  ⚠ 跳过（本地无文件）：${safeName}`);
      continue;
    }
    const buf = readFileSync(localPath);
    const key = `uploads/${safeName.replace(/\\/g, "/")}`;

    if (DRY) {
      pathToBlobUrl.set(`/uploads/${encodeURIComponent(safeName)}`, `https://example.blob.vercel-storage.com/${key}`);
      pathToBlobUrl.set(`/uploads/${safeName}`, `https://example.blob.vercel-storage.com/${key}`);
      filesUploaded++;
      console.log(`  [Dry] 将上传：${key}（${buf.length} bytes）`);
      continue;
    }

    const blob = await put(key, buf, {
      access: "public",
      addRandomSuffix: false,
      token: TOKEN,
    });
    pathToBlobUrl.set(`/uploads/${safeName}`, blob.url);
    pathToBlobUrl.set(`/uploads/${encodeURIComponent(safeName)}`, blob.url);
    filesUploaded++;
    console.log(`  ✅ ${key} → ${blob.url.slice(0, 60)}…`);
  }

  const pairs = [...pathToBlobUrl.entries()].sort((a, b) => b[0].length - a[0].length);

  let updated = 0;
  for (const q of questions) {
    let { content, answer, analysis } = q;
    let touched = false;
    const c = replaceUploadUrls(content, pairs);
    if (c.changed) {
      content = c.next;
      touched = true;
    }
    const a = replaceUploadUrls(answer, pairs);
    if (a.changed) {
      answer = a.next;
      touched = true;
    }
    const an = replaceUploadUrls(analysis, pairs);
    if (an.changed) {
      analysis = an.next;
      touched = true;
    }
    if (!touched) continue;
    if (!DRY) {
      await db.question.update({
        where: { id: q.id },
        data: { content, answer, analysis },
      });
    }
    updated++;
    if (DRY) console.log(`  [Dry] 将更新题目：${q.slug}`);
  }

  await db.$disconnect();

  console.log(
    `\n🎉 ${DRY ? "（dry run）" : ""}完成：成功准备/上传 ${filesUploaded} 个文件，更新题目 ${updated} 道。\n` +
      (DRY
        ? "去掉 DRY_RUN=1 后重新执行以实际上传并写库。"
        : "若目标为本地库，可再执行 TARGET_DATABASE_URL=… npm run sync-db:incremental 同步到 Neon。")
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
