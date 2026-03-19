"use client";

import React from "react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <div className="space-y-2">
      <Button onClick={() => window.print()} variant="outline">
        打印 / 导出 PDF
      </Button>
      <p className="text-xs text-muted-foreground max-w-md">
        题集页可勾选「打印换页」控制分页；地址栏参数{" "}
        <code className="bg-muted px-1 rounded text-[11px]">answerSpace=0</code>{" "}
        可隐藏每题后的答题区。
      </p>
    </div>
  );
}

