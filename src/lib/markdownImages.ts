/**
 * 题目 Markdown 中的图片路径解析（与 MathRenderer 展示逻辑一致）
 */

/** 将 Obsidian 双链图片 ![[path]] 转为标准 Markdown ![](url) */
export function preprocessObsidianImages(text: string): string {
  return text.replace(/!\s*\[\[([^\]]+)\]\]/g, (_, inner: string) => {
    const path = inner.split("|")[0].trim();
    if (!path) return "![]()";
    if (/^https?:\/\//i.test(path) || path.startsWith("/")) return `![](${path})`;
    return `![](/uploads/${encodeURIComponent(path)})`;
  });
}

/** 与 MathRenderer 中插图 src 规范化一致 */
export function normalizeMathRendererImageSrc(src: string): string {
  let s = (src || "").trim();
  if (!s) return s;
  if (!/^https?:\/\//i.test(s) && !s.startsWith("/")) s = "/" + s;
  return s;
}

/** 与 localStorage 键、尺寸表键一致：去掉协议 */
export function imageIntrinsicLookupKey(src: string): string {
  return normalizeMathRendererImageSrc(src).replace(/^https?:\/\//i, "");
}

const MD_IMG = /!\[([^\]]*)\]\(([^)]+)\)/g;
const HTML_IMG = /<img[^>]+src\s*=\s*["']([^"']+)["'][^>]*>/gi;

/** 从 Markdown 文本中收集所有图片 URL（含 Obsidian 双链展开后） */
export function extractImageSrcsFromMarkdown(text: string): string[] {
  const t = preprocessObsidianImages(text);
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  MD_IMG.lastIndex = 0;
  while ((m = MD_IMG.exec(t)) !== null) {
    out.add(normalizeMathRendererImageSrc(m[2].trim()));
  }
  HTML_IMG.lastIndex = 0;
  while ((m = HTML_IMG.exec(t)) !== null) {
    out.add(normalizeMathRendererImageSrc(m[1].trim()));
  }
  return Array.from(out);
}
