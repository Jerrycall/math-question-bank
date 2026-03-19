"use client";

import React from "react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <div className="space-y-2">
      <Button onClick={() => window.print()} variant="outline">
        打印 / 导出 PDF
      </Button>
      <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
        题集页可勾选「打印换页」；<code className="bg-muted px-1 rounded text-[11px]">answerSpace=0</code>{" "}
        可隐藏答题区。
        <br />
        <span className="text-foreground/80 font-medium">
          导出 PDF 时请在打印预览里关闭「页眉和页脚」
        </span>
        （Chrome：更多设置 → 取消勾选），否则底部会出现网址、日期等浏览器自带信息。
      </p>
    </div>
  );
}

