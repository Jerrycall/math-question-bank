"use client";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import "katex/dist/katex.min.css";

interface MathRendererProps {
  content: string;
  className?: string;
}

export function MathRenderer({ content, className }: MathRendererProps) {
  return (
    <div className={`prose prose-sm max-w-none dark:prose-invert ${className ?? ""}`}>
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
        {content}
      </ReactMarkdown>
    </div>
  );
}
