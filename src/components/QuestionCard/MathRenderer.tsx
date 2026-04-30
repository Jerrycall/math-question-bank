"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import "katex/dist/katex.min.css";

interface MathRendererProps {
  content: string;
  className?: string;
  /**
   * 传入后每张图按「scope + 图片路径」写入 localStorage，换页后仍保持宽度。
   * 建议：`${questionId}:content` / `:answer` / `:analysis` 等。
   */
  imageResizeScope?: string;
}

const IMG_WIDTH_STORAGE_PREFIX = "mqb:imgW:v1:";

function imageWidthStorageKey(scope: string, src: string): string {
  const path = src.replace(/^https?:\/\//i, "");
  return `${IMG_WIDTH_STORAGE_PREFIX}${scope}:${encodeURIComponent(path)}`;
}

function ResizableQuestionImage({
  src: srcProp,
  alt,
  imageResizeScope,
  className: imgClassName,
  ...imgProps
}: React.ImgHTMLAttributes<HTMLImageElement> & {
  imageResizeScope?: string;
}) {
  let src = (srcProp as string) ?? "";
  if (src && !/^https?:\/\//i.test(src) && !src.startsWith("/")) {
    src = "/" + src;
  }

  const storageKey = imageResizeScope
    ? imageWidthStorageKey(imageResizeScope, src)
    : null;
  const [widthPx, setWidthPx] = useState<number | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const w = parseInt(raw, 10);
      if (Number.isFinite(w) && w >= 80 && w <= 4200) setWidthPx(w);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || !storageKey) return;

    const scheduleSave = (w: number) => {
      if (w < 80 || w > 4200) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        try {
          localStorage.setItem(storageKey, String(Math.round(w)));
        } catch {
          /* quota */
        }
        debounceRef.current = null;
      }, 350);
    };

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) scheduleSave(w);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [storageKey]);

  return (
    <span
      ref={wrapperRef}
      style={widthPx != null ? { width: `${widthPx}px` } : undefined}
      className={cn(
        "my-3 mx-auto block min-w-[120px] max-w-full overflow-auto",
        widthPx == null ? "w-max" : "",
        storageKey && "resize-x print:resize-none",
        "rounded-lg border border-dashed border-border/50 hover:border-primary/40 shadow-sm"
      )}
      title={
        storageKey
          ? "拖动右侧边缘调整宽度；宽度会按题目记在本浏览器"
          : "拖动右侧边缘可调整插图显示宽度（打印时无效）"
      }
    >
      <img
        {...imgProps}
        src={src}
        alt={alt ?? "题目图片"}
        className={cn(
          "block h-auto max-h-[min(85vh,42rem)] w-full max-w-full object-contain rounded-md",
          imgClassName
        )}
        loading="lazy"
        draggable={false}
      />
    </span>
  );
}

// 将 Obsidian 双链图片 ![[path]] 转为标准 Markdown ![](url)，便于显示
function preprocessObsidianImages(text: string): string {
  return text.replace(/!\s*\[\[([^\]]+)\]\]/g, (_, inner: string) => {
    const path = inner.split("|")[0].trim();
    if (!path) return "![]()";
    if (/^https?:\/\//i.test(path) || path.startsWith("/")) return `![](${path})`;
    return `![](/uploads/${encodeURIComponent(path)})`;
  });
}

/** Obsidian 笔记双链 [[页面]] 或 [[页面|显示名]] → 加粗显示（避免整段裸链） */
function preprocessWikiLinks(text: string): string {
  return text.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_m, page: string, alias?: string) => {
      const label = (alias ?? page).trim() || page;
      return `**${label}**`;
    }
  );
}

/**
 * KaTeX 不支持 LaTeX 的 \\overparen（弧标记）；题干里又常见少写花括号：「\\overparen AB」。
 * 先规范为 \\overparen{…}，再由 rehypeKatex 的 macro 渲染为 \\overset{\\frown}{…}。
 */
function preprocessOverparen(text: string): string {
  let t = text.replace(/\\overparen(\s+)\{/g, "\\overparen{");
  t = t.replace(
    /\\overparen(\s+)([A-Za-z][A-Za-z0-9']*)/g,
    (_full, _sp: string, letters: string) => `\\overparen{${letters}}`
  );
  return t;
}

/**
 * remark-math 在「$$」与公式首段同一行时会把首段吞进 meta；闭合「$$」与末段同一行时可能把后续正文并进公式。
 * 规范化换行后，\\begin{cases} 等多行块公式才能被 KaTeX 正确解析（如上海题集 D336）。
 */
function normalizeDisplayMathFences(text: string): string {
  let t = text.replace(/(^|\n)(\$\$)\s*([^\n]+)$/gm, (_m, lead, delim, rest: string) => {
    if (!rest.trim()) return `${lead}${delim}`;
    return `${lead}${delim}\n${rest}`;
  });
  t = t.replace(/^(.*\S)(\$\$\s*)$/gm, "$1\n$2");
  return t;
}

const KATEX_MACROS = {
  "\\overparen": "\\overset{\\frown}{#1}",
  "\\Overparen": "\\overset{\\frown}{#1}",
};

function preprocessMarkdown(text: string): string {
  return normalizeDisplayMathFences(
    preprocessOverparen(preprocessWikiLinks(preprocessObsidianImages(text)))
  );
}

export function MathRenderer({
  content,
  className,
  imageResizeScope,
}: MathRendererProps) {
  const processedContent = preprocessMarkdown(content);
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[[rehypeKatex, { macros: KATEX_MACROS }]]}
        components={{
          table: ({ children, ...props }) => (
            <div className="overflow-x-auto my-4">
              <table
                className="min-w-full border-collapse border border-border text-sm"
                {...props}
              >
                {children}
              </table>
            </div>
          ),
          th: ({ children, ...props }) => (
            <th
              className="border border-border bg-muted px-3 py-2 text-left font-semibold"
              {...props}
            >
              {children}
            </th>
          ),
          td: ({ children, ...props }) => (
            <td className="border border-border px-3 py-2" {...props}>
              {children}
            </td>
          ),
          blockquote: ({ children, ...props }) => (
            <blockquote
              className="border-l-4 border-primary/40 bg-primary/5 pl-4 py-2 my-3 rounded-r-lg italic"
              {...props}
            >
              {children}
            </blockquote>
          ),
          img: ({ src, alt, ...props }) => (
            <ResizableQuestionImage
              src={(src as string) ?? ""}
              alt={alt as string | undefined}
              imageResizeScope={imageResizeScope}
              {...props}
            />
          ),
          code: ({ children, className: codeClass, ...props }) => {
            const isInline = !codeClass;
            if (isInline) {
              return (
                <code
                  className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className={`block bg-muted p-4 rounded-lg text-sm font-mono overflow-x-auto ${codeClass ?? ""}`}
                {...props}
              >
                {children}
              </code>
            );
          },
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
