"use client";

import React from "react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button
      className="printButton"
      onClick={() => window.print()}
      variant="outline"
    >
      打印 / 导出 PDF
    </Button>
  );
}

