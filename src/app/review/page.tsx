"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { RotateCcw, Calendar, BookOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReviewSession } from "@/components/ReviewSession";
import { ReviewSchedule } from "@/types";

export default function ReviewPage() {
  const [schedules, setSchedules] = useState<ReviewSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [needsLogin, setNeedsLogin] = useState(false);

  useEffect(() => {
    fetch("/api/review")
      .then((r) => {
        if (r.status === 401) {
          setNeedsLogin(true);
          return { schedules: [] };
        }
        return r.json();
      })
      .then((data) => {
        setSchedules(data.schedules ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-48 bg-muted rounded" />
      </div>
    );
  }

  if (needsLogin) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
            <RotateCcw className="h-5 w-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">间隔复习</h1>
            <p className="text-sm text-muted-foreground">SM-2 算法驱动，科学安排复习计划</p>
          </div>
        </div>
        <Card className="text-center py-12">
          <CardContent>
            <p className="text-muted-foreground mb-4">使用间隔复习与学习统计需先登录</p>
            <Link
              href="/login?from=/review"
              className={cn(
                "inline-flex items-center justify-center rounded-lg font-medium h-9 px-4 py-2 text-sm",
                "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
            >
              去登录
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 头部 */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
          <RotateCcw className="h-5 w-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">间隔复习</h1>
          <p className="text-sm text-muted-foreground">
            SM-2 算法驱动，科学安排复习计划
          </p>
        </div>
      </div>

      {!sessionStarted ? (
        <div className="space-y-4">
          {/* 统计卡片 */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-5 text-center">
                <Calendar className="h-8 w-8 mx-auto text-orange-500 mb-2" />
                <p className="text-3xl font-bold">{schedules.length}</p>
                <p className="text-sm text-muted-foreground mt-1">今日待复习</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-center">
                <BookOpen className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                <p className="text-3xl font-bold">
                  {Math.ceil(schedules.length * 1.5)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">预计分钟</p>
              </CardContent>
            </Card>
          </div>

          {/* 今日复习列表预览 */}
          {schedules.length > 0 ? (
            <div className="space-y-3">
              <h2 className="font-semibold">今日复习内容</h2>
              <div className="space-y-2">
                {schedules.slice(0, 5).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card"
                  >
                    <div>
                      <p className="text-sm font-medium line-clamp-1">
                        {s.question?.title ?? "加载中..."}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        已复习 {s.repetitions} 次 · 间隔 {s.intervalDays} 天
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                      <p>难易因子</p>
                      <p className="font-medium">{s.easeFactor.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
                {schedules.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    还有 {schedules.length - 5} 道题...
                  </p>
                )}
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={() => setSessionStarted(true)}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                开始今日复习 ({schedules.length} 道)
              </Button>
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <div className="text-5xl mb-4">🎉</div>
                <h2 className="text-xl font-bold mb-2">今日复习已完成！</h2>
                <p className="text-muted-foreground text-sm">
                  暂无待复习题目，继续做新题，系统会自动安排复习计划
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => (window.location.href = "/questions")}
                >
                  去刷新题
                </Button>
              </CardContent>
            </Card>
          )}

          {/* SM-2 算法说明 */}
          <Card className="bg-muted/40">
            <CardContent className="p-4">
              <h3 className="text-sm font-semibold mb-2">间隔复习原理（SM-2 算法）</h3>
              <div className="space-y-1.5 text-xs text-muted-foreground">
                <p>• 首次学习：1天后复习</p>
                <p>• 答对后，下次复习时间按难易因子倍增延长</p>
                <p>• 答错后，重新从第1天开始</p>
                <p>• 系统根据你的表现自动调整每题的复习间隔</p>
                <p className="text-primary font-medium mt-2">
                  评分：0=完全不会 / 3=勉强答对 / 5=完全掌握
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <ReviewSession
          schedules={schedules}
          onComplete={() => {
            setSessionStarted(false);
            setSchedules([]);
          }}
        />
      )}
    </div>
  );
}
