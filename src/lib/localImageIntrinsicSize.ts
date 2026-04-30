import { existsSync } from "fs";
import { join } from "path";
import { imageSizeFromFile } from "image-size/fromFile";
import {
  imageIntrinsicLookupKey,
  normalizeMathRendererImageSrc,
} from "@/lib/markdownImages";

function resolveUploadDiskPath(normalizedUrlPath: string): string | null {
  const rel = normalizedUrlPath.replace(/^\//, "");
  const base = join(process.cwd(), "public");
  const direct = join(base, rel);
  if (existsSync(direct)) return direct;
  try {
    const decodedRel = decodeURIComponent(rel);
    if (decodedRel !== rel) {
      const decoded = join(base, decodedRel);
      if (existsSync(decoded)) return decoded;
    }
  } catch {
    /* invalid %序列 */
  }
  return null;
}

/**
 * 读取 public/uploads 下图片文件的像素尺寸（与题库 Markdown 中 /uploads/... 对应）。
 * 用于打印/PDF：按文件真实宽高排版，避免被 CSS 放大。
 */
export async function buildIntrinsicSizeMapForPrint(
  srcs: ReadonlySet<string> | string[]
): Promise<Record<string, { width: number; height: number }>> {
  const map: Record<string, { width: number; height: number }> = {};
  const doneKeys = new Set<string>();

  for (const raw of Array.from(srcs)) {
    const normalized = normalizeMathRendererImageSrc(raw);
    if (!normalized.startsWith("/uploads/")) continue;

    const key = imageIntrinsicLookupKey(normalized);
    if (doneKeys.has(key)) continue;
    doneKeys.add(key);

    const disk = resolveUploadDiskPath(normalized);
    if (!disk) continue;

    try {
      const r = await imageSizeFromFile(disk);
      if (r.width && r.height && r.width > 0 && r.height > 0) {
        map[key] = { width: r.width, height: r.height };
      }
    } catch {
      /* 非图片或损坏 */
    }
  }

  return map;
}
