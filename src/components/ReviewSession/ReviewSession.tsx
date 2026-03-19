"use client";

import React, { useState, useEffect, useRef } from "react";
import { CheckCircle, XCircle, Clock, ChevronRight, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MathRenderer } from "@/components/QuestionCard/MathRenderer";
import { ReviewSchedule, SM2Quality } from "@/types";

interface ReviewSessionProps {
  schedules: ReviewSchedule[];
  onComplete?: (results: ReviewResult[]) => void;
}

interface ReviewResult {
  scheduleId: string;
  questionId: string;
  quality: SM2Quality;
  timeSpentS: number;
  isCorrect: boolean;
}

type ReviewStep = "question" | "answer" | "rating";

export function ReviewSession({
  schedules,
  onComplete,
}: ReviewSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [step, setStep] = useState<ReviewStep>("question");
  const [results, setResults] = useState<ReviewResult[]>([]);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  const current = schedules[currentIndex];
  const progress = ((currentIndex) / schedules.length) * 100;

  useEffect(() => {
    setStartTime(Date.now());
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - Date.now()) / 1000));
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [currentIndex]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const handleShowAnswer = () => {
    setStep("answer");
  };

  const handleRating = async (quality: SM2Quality) => {
    const timeSpentS = Math.floor((Date.now() - startTime) / 1000);
    const isCorrect = quality >= 3;

    const result: ReviewResult = {
      scheduleId: current.id,
      questionId: current.questionId,
      quality,
      timeSpentS,
      isCorrect,
    };

    // 提交复习结果到 API
    try {
      await fetch("/api/review/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });
    } catch {
      // 静默失败，不影响用户体验
    }

    const newResults = [...results, result];
    setResults(newResults);

    if (currentIndex + 1 >= schedules.length) {
      setIsFinished(true);
      onComplete?.(newResults);
    } else {
      setCurrentIndex((i) => i + 1);
      setStep("question");
      setElapsed(0);
      setStartTime(Date.now());
    }
  };

  if (schedules.length === 0) {
    return (
      <Card className="text-center py-16">
        <CardContent>
          <Trophy className="h-16 w-16 mx-auto text-yellow-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">今日复习完成！</h2>
          <p className="text-muted-foreground">暂时没有待复习的题目，继续保持！</p>
        </CardContent>
      </Card>
    );
  }

  if (isFinished) {
    const correctCount = results.filter((r) => r.isCorrect).length;
    const accuracy = Math.round((correctCount / results.length) * 100);
    const avgTime = Math.round(
      results.reduce((s, r) => s + r.timeSpentS, 0) / results.length
    );

    return (
      <Card className="text-center py-12">
        <CardContent className="space-y-6">
          <Trophy className="h-16 w-16 mx-auto text-yellow-500" />
          <div>
            <h2 className="text-2xl font-bold mb-2">复习完成！</h2>
            <p className="text-muted-foreground">
              本次共复习 {results.length} 道题目
            </p>
          </div>
          <div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
            <div className="text-center p-3 rounded-lg bg-muted">
              <p className="text-2xl font-bold text-green-600">{accuracy}%</p>
              <p className="text-xs text-muted-foreground mt-1">正确率</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted">
              <p className="text-2xl font-bold text-blue-600">{correctCount}</p>
              <p className="text-xs text-muted-foreground mt-1">答对题数</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted">
              <p className="text-2xl font-bold text-purple-600">{avgTime}s</p>
              <p className="text-xs text-muted-foreground mt-1">平均耗时</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!current?.question) return null;

  const ratingButtons: {
    quality: SM2Quality;
    label: string;
    desc: string;
    className: string;
  }[] = [
    {
      quality: 0,
      label: "完全不会",
      desc: "毫无印象",
      className: "border-red-500 text-red-600 hover:bg-red-50",
    },
    {
      quality: 1,
      label: "错误",
      desc: "答案陌生",
      className: "border-orange-500 text-orange-600 hover:bg-orange-50",
    },
    {
      quality: 2,
      label: "有点印象",
      desc: "但答错了",
      className: "border-yellow-500 text-yellow-600 hover:bg-yellow-50",
    },
    {
      quality: 3,
      label: "勉强答对",
      desc: "有些困难",
      className: "border-lime-500 text-lime-600 hover:bg-lime-50",
    },
    {
      quality: 4,
      label: "答对了",
      desc: "稍有犹豫",
      className: "border-green-500 text-green-600 hover:bg-green-50",
    },
    {
      quality: 5,
      label: "完全掌握",
      desc: "反应迅速",
      className: "border-emerald-500 text-emerald-600 hover:bg-emerald-50",
    },
  ];

  return (
    <div className="space-y-4">
      {/* 进度条 */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>
            第 {currentIndex + 1} / {schedules.length} 题
          </span>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{elapsed}s</span>
          </div>
        </div>
        <Progress value={progress} />
      </div>

      {/* 题目卡片 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {current.question.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-muted/40 p-4">
            <MathRenderer content={current.question.content} />
          </div>

          {step === "question" && (
            <Button
              className="w-full"
              onClick={handleShowAnswer}
            >
              查看答案
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}

          {(step === "answer" || step === "rating") && (
            <div className="space-y-4">
              {/* 答案 */}
              <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 p-4">
                <p className="text-xs font-semibold text-green-700 mb-2">标准答案</p>
                <MathRenderer content={current.question.answer} />
              </div>

              {/* 评分按钮 */}
              <div>
                <p className="text-sm font-medium mb-3 text-center text-muted-foreground">
                  你的掌握程度如何？
                </p>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {ratingButtons.map(({ quality, label, desc, className }) => (
                    <button
                      key={quality}
                      onClick={() => handleRating(quality)}
                      className={`flex flex-col items-center p-2 rounded-lg border-2 transition-colors text-center ${className}`}
                    >
                      {quality >= 3 ? (
                        <CheckCircle className="h-5 w-5 mb-1" />
                      ) : (
                        <XCircle className="h-5 w-5 mb-1" />
                      )}
                      <span className="text-xs font-semibold">{label}</span>
                      <span className="text-xs opacity-60">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
