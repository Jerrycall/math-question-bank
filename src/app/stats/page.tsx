"use client";

import React, { useState, useEffect } from "react";
import { BarChart3, Target, Clock, CheckCircle, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MasteryRadar } from "@/components/StatsCharts/MasteryRadar";
import { AccuracyTrend } from "@/components/StatsCharts/AccuracyTrend";
import { Progress } from "@/components/ui/progress";
import { KnowledgeMastery } from "@/types";
import Link from "next/link";

interface StatsData {
  overview: {
    totalAttempts: number;
    totalTimeS: number;
    pendingReview: number;
    overallAccuracy: number;
  };
  masteryData: KnowledgeMastery[];
  dailyStats: Array<{ date: string; accuracy: number; count: number }>;
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats?days=30")
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded" />
          ))}
        </div>
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  const totalMinutes = Math.round((stats?.overview.totalTimeS ?? 0) / 60);

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-cyan-100 flex items-center justify-center">
          <BarChart3 className="h-5 w-5 text-cyan-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">学习统计</h1>
          <p className="text-sm text-muted-foreground">掌握度分析 · 进步趋势 · 错题管理</p>
        </div>
      </div>

      {/* 概览卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            icon: CheckCircle,
            label: "总做题数",
            value: stats?.overview.totalAttempts ?? 0,
            color: "text-green-500",
            bg: "bg-green-50 dark:bg-green-950/20",
          },
          {
            icon: Target,
            label: "整体正确率",
            value: `${stats?.overview.overallAccuracy ?? 0}%`,
            color: "text-blue-500",
            bg: "bg-blue-50 dark:bg-blue-950/20",
          },
          {
            icon: Clock,
            label: "学习总时长",
            value: `${totalMinutes} 分钟`,
            color: "text-purple-500",
            bg: "bg-purple-50 dark:bg-purple-950/20",
          },
          {
            icon: TrendingUp,
            label: "待复习题数",
            value: stats?.overview.pendingReview ?? 0,
            color: "text-orange-500",
            bg: "bg-orange-50 dark:bg-orange-950/20",
          },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs text-muted-foreground mt-1">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 知识点掌握度雷达图 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">知识点掌握度</CardTitle>
          </CardHeader>
          <CardContent>
            <MasteryRadar masteryData={stats?.masteryData ?? []} />
          </CardContent>
        </Card>

        {/* 正确率趋势 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">近30天正确率趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <AccuracyTrend data={stats?.dailyStats ?? []} />
          </CardContent>
        </Card>
      </div>

      {/* 知识点掌握度列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">各知识点掌握进度</CardTitle>
        </CardHeader>
        <CardContent>
          {(stats?.masteryData ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              开始做题后，掌握度数据将在这里显示
            </p>
          ) : (
            <div className="space-y-4">
              {(stats?.masteryData ?? []).map((m) => (
                <div key={m.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <Link
                      href={`/tags/${m.tag?.slug ?? ""}`}
                      className="text-sm font-medium hover:text-primary transition-colors"
                    >
                      {m.tag?.name ?? "未知"}
                    </Link>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        {m.correctAttempts}/{m.totalAttempts} 题
                      </span>
                      <span
                        className={
                          m.masteryScore >= 80
                            ? "text-green-600 font-semibold"
                            : m.masteryScore >= 60
                            ? "text-yellow-600 font-semibold"
                            : "text-red-500 font-semibold"
                        }
                      >
                        {m.masteryScore}%
                      </span>
                    </div>
                  </div>
                  <Progress
                    value={m.masteryScore}
                    className={
                      m.masteryScore >= 80
                        ? "[&>div]:bg-green-500"
                        : m.masteryScore >= 60
                        ? "[&>div]:bg-yellow-500"
                        : "[&>div]:bg-red-500"
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
