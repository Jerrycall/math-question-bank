"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Sparkles,
  Send,
  Loader2,
  RefreshCw,
  Network,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { QuestionCard } from "@/components/QuestionCard";
import { MathRenderer } from "@/components/QuestionCard/MathRenderer";
import {
  Question,
  TAG_TYPE_COLORS,
  TAG_TYPE_LABELS,
} from "@/types";

export default function QuestionDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [question, setQuestion] = useState<Question | null>(null);
  const [similar, setSimilar] = useState<Question[]>([]);
  const [variants, setVariants] = useState<Array<{ level: string; title: string; question: string; answer: string; analysis: string; changedAspect: string }>>([]);
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/questions/${slug}`)
      .then((r) => r.json())
      .then((data) => {
        setQuestion(data);
        setLoading(false);
        // 加载相似题
        if (data.id) {
          fetch("/api/ai/similar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId: data.id }),
          })
            .then((r) => r.json())
            .then((d) => setSimilar(d.similar?.slice(0, 3) ?? []))
            .catch(() => {});
        }
      })
      .catch(() => setLoading(false));
  }, [slug]);

  const handleAskAI = async () => {
    if (!aiQuery.trim() || !question?.id) return;
    setAiLoading(true);
    setAiResponse("");

    try {
      const res = await fetch("/api/ai/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, userQuery: aiQuery }),
      });

      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        setAiResponse(fullText);
      }
    } catch {
      setAiResponse("AI 服务暂时不可用，请检查配置。");
    } finally {
      setAiLoading(false);
    }
  };

  const handleGenerateVariants = async () => {
    if (!question?.id) return;
    setVariantsLoading(true);
    try {
      const res = await fetch("/api/ai/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id }),
      });
      const data = await res.json();
      setVariants(data.variants ?? []);
    } catch {
      setVariants([]);
    } finally {
      setVariantsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-muted rounded w-1/3" />
        <div className="h-64 bg-muted rounded" />
      </div>
    );
  }

  if (!question) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">题目不存在</p>
        <Link href="/questions">
          <Button variant="outline" className="mt-4">返回题库</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* 返回按钮 */}
      <Link href="/questions" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ChevronLeft className="h-4 w-4" />
        返回题库
      </Link>

      {/* 主题目卡片 */}
      <QuestionCard question={question} showAnswer />

      {/* 标签详情 */}
      {question.tags && question.tags.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Network className="h-4 w-4" />
              知识关联
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(["KNOWLEDGE", "METHOD", "THOUGHT", "SOURCE"] as const).map((type) => {
              const typeTags = question.tags!.filter((t) => t.tag.type === type);
              if (typeTags.length === 0) return null;
              return (
                <div key={type} className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">
                    {TAG_TYPE_LABELS[type]}
                  </span>
                  {typeTags.map(({ tag }) => (
                    <Link key={tag.id} href={`/tags/${tag.slug}`}>
                      <Badge className={`text-xs cursor-pointer hover:opacity-80 ${TAG_TYPE_COLORS[type]}`}>
                        {tag.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* AI 助手 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            AI 答疑助手
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="例如：为什么要令 f'(x) > 0？第二步不懂..."
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAskAI()}
            />
            <Button
              onClick={handleAskAI}
              disabled={aiLoading || !aiQuery.trim()}
              size="icon"
            >
              {aiLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {aiResponse && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
              <MathRenderer content={aiResponse} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* 变式题 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">AI 生成变式题</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateVariants}
              disabled={variantsLoading}
            >
              {variantsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              生成变式题
            </Button>
          </div>
        </CardHeader>
        {variants.length > 0 && (
          <CardContent className="space-y-4">
            {variants.map((v, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {v.level === "easier" ? "降难度" : v.level === "harder" ? "升难度" : "同难度"}
                  </Badge>
                  <span className="font-medium text-sm">{v.title}</span>
                </div>
                <p className="text-xs text-muted-foreground">改变点：{v.changedAspect}</p>
                <div className="bg-muted/40 rounded p-3">
                  <MathRenderer content={v.question} />
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground text-xs">
                    查看答案与解析
                  </summary>
                  <div className="mt-2 space-y-2">
                    <div className="bg-green-50 dark:bg-green-950/20 rounded p-3 text-xs">
                      <strong>答案：</strong><MathRenderer content={v.answer} />
                    </div>
                    <div className="bg-blue-50 dark:bg-blue-950/20 rounded p-3 text-xs">
                      <strong>解析：</strong><MathRenderer content={v.analysis} />
                    </div>
                  </div>
                </details>
              </div>
            ))}
          </CardContent>
        )}
      </Card>

      {/* 相似题推荐 */}
      {similar.length > 0 && (
        <div>
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            相似题推荐
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {similar.map((q) => (
              <QuestionCard key={q.id} question={q} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
