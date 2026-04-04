"use client";

import React from "react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import "katex/dist/katex.min.css";

interface MathRendererProps {
  content: string;
  className?: string;
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

function preprocessMarkdown(text: string): string {
  return normalizeDisplayMathFences(
    preprocessWikiLinks(preprocessObsidianImages(text))
  );
}

export function MathRenderer({ content, className }: MathRendererProps) {
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
        rehypePlugins={[rehypeKatex]}
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
          img: ({ src, alt, ...props }) => {
            // 相对路径转成站根绝对路径，避免在 /questions/xxx 等页面请求到错误地址
            let imgSrc = src ?? "";
            if (imgSrc && !/^https?:\/\//i.test(imgSrc) && !imgSrc.startsWith("/")) {
              imgSrc = "/" + imgSrc;
            }
            return (
              <span className="my-3 block">
                <img
                  src={imgSrc}
                  alt={alt ?? "题目图片"}
                  className="max-w-full h-auto rounded-lg border border-border"
                  loading="lazy"
                  {...props}
                />
              </span>
            );
          },
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
