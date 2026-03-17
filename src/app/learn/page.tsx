"use client";

import React, { useState } from "react";
import { Brain, Wand2, Loader2, Plus, CheckCircle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MathRenderer } from "@/components/QuestionCard/MathRenderer";
import { TAG_TYPE_LABELS, TAG_TYPE_COLORS } from "@/types";

interface StructuredResult {
  title: string;
  knowledge: string[];
  method: string[];
  thought: string[];
  difficulty: number;
  analysis: string;
  answer: string;
  errorProne: string;
  variantDirection: string;
}

export default function LearnPage() {
  const [rawText, setRawText] = useState("");
  const [structured, setStructured] = useState<StructuredResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const handleStructurize = async () => {
    if (!rawText.trim()) return;
    setLoading(true);
    setError("");
    setStructured(null);
    setSaved(false);

    try {
      const res = await fetch("/api/ai/structurize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setStructured(data.structured);
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!rawText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/ai/structurize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: rawText, save: true }),
      });
      const data = await res.json();
      if (data.questionId) {
        setSaved(true);
        setTimeout(() => {
          window.location.href = "/questions";
        }, 1500);
      }
    } catch {
      setError("保存失败");
    } finally {
      setSaving(false);
    }
  };

  const difficultyStars = structured
    ? "★".repeat(structured.difficulty) + "☆".repeat(5 - structured.difficulty)
    : "";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 头部 */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-pink-100 flex items-center justify-center">
          <Brain className="h-5 w-5 text-pink-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">AI 助手</h1>
          <p className="text-sm text-muted-foreground">
            粘贴题目，AI 自动提取知识结构、生成解析
          </p>
        </div>
      </div>

      {/* 输入区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            题目自动结构化
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="w-full h-40 rounded-lg border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
            placeholder={`粘贴或输入题目，例如：

已知函数 f(x) = x³ - 3x + 2，求 f(x) 的单调递增区间。

AI 将自动：
• 识别知识点、方法、数学思想
• 生成详细分步解析
• 评估难度等级
• 提示易错点`}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
          />

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleStructurize}
              disabled={loading || !rawText.trim()}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  AI 分析中...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  AI 结构化分析
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 结构化结果 */}
      {structured && (
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-base">{structured.title}</CardTitle>
              <span className="text-sm text-amber-500">{difficultyStars}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 标签 */}
            <div className="space-y-2">
              {[
                {
                  tags: structured.knowledge,
                  type: "KNOWLEDGE" as const,
                },
                { tags: structured.method, type: "METHOD" as const },
                { tags: structured.thought, type: "THOUGHT" as const },
              ].map(({ tags, type }) => (
                <div key={type} className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground w-12 shrink-0">
                    {TAG_TYPE_LABELS[type]}
                  </span>
                  {tags.map((t) => (
                    <Badge
                      key={t}
                      className={`text-xs ${TAG_TYPE_COLORS[type]}`}
                    >
                      {t}
                    </Badge>
                  ))}
                </div>
              ))}
            </div>

            {/* 答案 */}
            <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 p-4">
              <p className="text-xs font-semibold text-green-700 mb-2">标准答案</p>
              <MathRenderer content={structured.answer} />
            </div>

            {/* 解析 */}
            <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-4">
              <p className="text-xs font-semibold text-blue-700 mb-2">详细解析</p>
              <MathRenderer content={structured.analysis} />
            </div>

            {/* 易错点 */}
            {structured.errorProne && (
              <div className="flex gap-2 text-sm bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-amber-700 text-xs mb-1">易错点</p>
                  <p className="text-amber-900 dark:text-amber-200 text-xs">{structured.errorProne}</p>
                </div>
              </div>
            )}

            {/* 变式方向 */}
            {structured.variantDirection && (
              <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
                <span className="font-medium">变式方向：</span>
                {structured.variantDirection}
              </div>
            )}

            {/* 保存按钮 */}
            {saved ? (
              <div className="flex items-center justify-center gap-2 text-green-600 py-2">
                <CheckCircle className="h-5 w-5" />
                <span>已保存到题库，正在跳转...</span>
              </div>
            ) : (
              <Button
                onClick={handleSave}
                disabled={saving}
                variant="outline"
                className="w-full border-primary text-primary hover:bg-primary hover:text-primary-foreground"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    保存到题库
                  </>
                )}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* 快速导入说明 */}
      <Card className="bg-muted/40">
        <CardContent className="p-4 space-y-2">
          <h3 className="text-sm font-semibold">使用说明</h3>
          <div className="text-xs text-muted-foreground space-y-1.5">
            <p>1. 将题目文字（含题干、已知条件）粘贴到上方输入框</p>
            <p>2. 点击「AI 结构化分析」，自动提取知识点、生成解析</p>
            <p>3. 确认结果后点击「保存到题库」，系统自动建立知识关联</p>
            <p>4. 保存后可在题库、知识图谱中查看，并自动加入复习计划</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-amber-600 mt-2">
            <AlertCircle className="h-3.5 w-3.5" />
            需要配置 OpenAI API Key（在 .env.local 文件中）
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
