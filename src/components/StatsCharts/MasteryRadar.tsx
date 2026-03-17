"use client";

import React from "react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { KnowledgeMastery } from "@/types";

interface MasteryRadarProps {
  masteryData: KnowledgeMastery[];
}

export function MasteryRadar({ masteryData }: MasteryRadarProps) {
  const data = masteryData.slice(0, 8).map((m) => ({
    subject: m.tag?.name ?? "未知",
    mastery: m.masteryScore,
    fullMark: 100,
  }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        暂无掌握度数据，开始做题后会自动更新
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fontSize: 12, fill: "#64748b" }}
        />
        <Radar
          name="掌握度"
          dataKey="mastery"
          stroke="#6366f1"
          fill="#6366f1"
          fillOpacity={0.3}
          strokeWidth={2}
        />
        <Tooltip
          formatter={(value: number) => [`${value}%`, "掌握度"]}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
