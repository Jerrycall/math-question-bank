"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

interface DailyStats {
  date: string;
  accuracy: number;
  count: number;
}

interface AccuracyTrendProps {
  data: DailyStats[];
}

export function AccuracyTrend({ data }: AccuracyTrendProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        暂无做题记录
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            name === "accuracy" ? `${value}%` : value,
            name === "accuracy" ? "正确率" : "做题数",
          ]}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} />
        <Line
          type="monotone"
          dataKey="accuracy"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ r: 3, fill: "#6366f1" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
