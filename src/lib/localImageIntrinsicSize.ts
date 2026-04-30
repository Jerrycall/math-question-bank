import { existsSync } from "fs";
import { join } from "path";
import { imageSizeFromFile } from "image-size/fromFile";
import {
  imageIntrinsicLookupKey,
  normalizeMathRendererImageSrc,
} from "@/lib/markdownImages";

/** 打印用的 layout 属性不宜使用原始像素（如 3000px），否则部分浏览器在 PDF 中仍按过大「最小尺寸」排版 */
const PRINT_IMAGE_MAX_LONG_SIDE_PX = 420;

function capDimensionsForPrintLayout(
  width: number,
  height: number
): { width: number; height: number } {
  const long = Math.max(width, height);
  if (long <= PRINT_IMAGE_MAX_LONG_SIDE_PX) return { width, height };
  const scale = PRINT_IMAGE_MAX_LONG_SIDE_PX / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

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
        map[key] = capDimensionsForPrintLayout(r.width, r.height);
      }
    } catch {
      /* 非图片或损坏 */
    }
  }

  return map;
}
