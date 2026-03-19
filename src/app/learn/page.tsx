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

/** fetch 在未收到完整 HTTP 响应就失败时（非 4xx/5xx JSON），浏览器常报 Failed to fetch */
function fetchErrorHint(e: unknown): string {
  if (e instanceof DOMException && e.name === "AbortError") {
    return "等待超过 2 分钟已中止。结构化分析较慢时可缩短题目或稍后重试。";
  }
  const raw = e instanceof Error ? e.message : String(e);
  const m = raw.trim();
  const lower = m.toLowerCase();
  const looksLikeNetworkDrop =
    !m ||
    lower === "failed to fetch" ||
    lower.includes("load failed") ||
    lower.includes("networkerror") ||
    lower.includes("network request failed");

  if (looksLikeNetworkDrop) {
    return [
      "无法完成请求（连接在收到服务器响应前中断）。",
      "常见原因：① AI 接口较慢导致服务端超时或网关断开；② 当前网络/代理不稳定；③ 广告拦截、隐私类扩展误拦了接口。",
      "建议：换网络或暂时关闭相关插件后重试；在 Vercel 打开该次 Deployment 的 Functions / Logs 查看是否超时或报错。",
    ].join("");
  }
  return m || "网络错误，请检查连接后重试。";
}

function structurizeFetchInit(body: object): RequestInit {
  const init: RequestInit = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
  const AS = typeof AbortSignal !== "undefined" ? AbortSignal : null;
  const timeoutFn =
    AS && "timeout" in AS && typeof (AS as { timeout?: (ms: number) => AbortSignal }).timeout === "function"
      ? (AS as { timeout: (ms: number) => AbortSignal }).timeout
      : null;
  if (timeoutFn) init.signal = timeoutFn(120_000);
  return init;
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
      const res = await fetch(
        "/api/ai/structurize",
        structurizeFetchInit({ text: rawText })
      );
      const raw = await res.text();
      let data: { error?: string; structured?: StructuredResult } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        setError(
          res.ok
            ? "返回格式异常，请稍后重试。"
            : `请求失败（${res.status}）。若为 504，说明 AI 响应超时，可缩短题目文字后重试。`
        );
        return;
      }
      if (!res.ok || data.error) {
        setError(data.error || `请求失败（${res.status}）`);
        return;
      }
      if (data.structured) {
        setStructured(data.structured);
      } else {
        setError("未返回结构化结果，请重试。");
      }
    } catch (e) {
      setError(fetchErrorHint(e));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!rawText.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(
        "/api/ai/structurize",
        structurizeFetchInit({ text: rawText, save: true })
      );
      const raw = await res.text();
      let data: { error?: string; questionId?: string } = {};
      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        setError("保存失败：服务器返回异常，请重试。");
        return;
      }
      if (data.error) {
        setError(data.error);
        return;
      }
      if (data.questionId) {
        setSaved(true);
        setTimeout(() => {
          window.location.href = "/questions";
        }, 1500);
      } else {
        setError("保存失败：未返回题目 ID。");
      }
    } catch (e) {
      setError(`保存失败：${fetchErrorHint(e)}`);
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
          <div className="flex items-start gap-1.5 text-xs text-amber-600 mt-2">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              需在环境变量中配置 AI：对话可用{" "}
              <code className="rounded bg-muted px-1">AI_API_KEY</code> +{" "}
              <code className="rounded bg-muted px-1">AI_API_BASE_URL</code>（如
              DeepSeek）或 <code className="rounded bg-muted px-1">OPENAI_API_KEY</code>
              。「保存到题库」还会写入向量，需另配{" "}
              <code className="rounded bg-muted px-1">OPENAI_API_KEY</code>（OpenAI
              embedding）。本地写在 <code className="rounded bg-muted px-1">.env.local</code>
              ，线上在 Vercel → Settings → Environment Variables。
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
