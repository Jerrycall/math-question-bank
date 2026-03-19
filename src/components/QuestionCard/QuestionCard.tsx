"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ArrowRight,
  Tag,
  BookmarkPlus,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MathRenderer } from "./MathRenderer";
import {
  Question,
  type Difficulty,
  DIFFICULTY_LABELS,
  DIFFICULTY_COLORS,
  TAG_TYPE_COLORS,
  TAG_TYPE_LABELS,
  TagType,
} from "@/types";

/** 卡片展示用题目（API 返回可能不含 createdAt，枚举可能是 string） */
export type QuestionCardQuestion = Omit<Question, "createdAt" | "difficulty"> & {
  createdAt?: string | Date;
  difficulty: Question["difficulty"] | string;
};

type MyCollectionSummary = {
  id: string;
  name: string;
  _count?: { questions: number };
};

let myCollectionsCache: MyCollectionSummary[] | null = null;
let myCollectionsCachePromise: Promise<MyCollectionSummary[]> | null = null;

/** 创建题集后调用，使题集列表下拉框刷新 */
export function invalidateMyCollectionsCache() {
  myCollectionsCache = null;
  myCollectionsCachePromise = null;
}

interface QuestionCardProps {
  question: QuestionCardQuestion;
  showAnswer?: boolean;
  compact?: boolean;
  /** 选题模式：显示勾选框，隐藏「加入题集」按钮 */
  selection?: {
    checked: boolean;
    onChange: () => void;
  };
}

export function QuestionCard({
  question,
  showAnswer = false,
  compact = false,
  selection,
}: QuestionCardProps) {
  const [answerVisible, setAnswerVisible] = useState(showAnswer);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [collections, setCollections] = useState<MyCollectionSummary[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [addingToCollectionId, setAddingToCollectionId] = useState<string | null>(null);

  const returnTo = useMemo(() => {
    if (typeof window === "undefined") return "/questions";
    const qs = window.location.search || "";
    return `${window.location.pathname}${qs}`;
  }, []);

  async function loadMyCollections(forceRefresh = false) {
    if (!forceRefresh && myCollectionsCache) {
      setCollections(myCollectionsCache);
      return;
    }

    if (!myCollectionsCachePromise || forceRefresh) {
      myCollectionsCachePromise = (async () => {
        const res = await fetch("/api/collections", { credentials: "include" });
        if (!res.ok) return [];
        const data = await res.json().catch(() => ({}));
        const list = Array.isArray(data?.collections) ? data.collections : [];
        myCollectionsCache = list;
        return list as MyCollectionSummary[];
      })();
    }

    const list = await myCollectionsCachePromise;
    setCollections(list);
  }

  async function ensureAuthAndOpen() {
    setPickerOpen(true);
    setPickerLoading(true);
    try {
      const meRes = await fetch("/api/auth/me", { credentials: "include" });
      if (!meRes.ok) {
        window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
        return;
      }
      await loadMyCollections(false);
    } finally {
      setPickerLoading(false);
    }
  }

  async function addToCollection(collectionId: string) {
    if (addingToCollectionId) return;
    setAddingToCollectionId(collectionId);
    try {
      const res = await fetch(`/api/collections/${collectionId}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ questionIds: [question.id] }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || "添加失败");
        return;
      }
      setPickerOpen(false);
    } catch (e) {
      console.error("addToCollection error:", e);
      alert("添加失败");
    } finally {
      setAddingToCollectionId(null);
    }
  }

  async function createCollectionAndRefresh() {
    const name = window.prompt("请输入题集名称（最多 50 字）");
    if (!name) return;

    setPickerLoading(true);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || "创建失败");
        return;
      }
      myCollectionsCache = null;
      myCollectionsCachePromise = null;
      await loadMyCollections(true);
    } finally {
      setPickerLoading(false);
    }
  }

  const knowledgeTags =
    question.tags?.filter((t) => t.tag.type === "KNOWLEDGE") ?? [];
  const methodTags =
    question.tags?.filter((t) => t.tag.type === "METHOD") ?? [];
  const thoughtTags =
    question.tags?.filter((t) => t.tag.type === "THOUGHT") ?? [];
  const sourceTags =
    question.tags?.filter((t) => t.tag.type === "SOURCE") ?? [];

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {selection && (
              <label className="flex items-center pt-1 shrink-0 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={selection.checked}
                  onChange={selection.onChange}
                  aria-label={`选题：${question.title}`}
                />
              </label>
            )}
            <Link
              href={`/questions/${question.slug}`}
              className="text-base font-semibold hover:text-primary transition-colors line-clamp-2 flex-1 min-w-0"
            >
              {question.title}
            </Link>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge
              className={`text-xs ${DIFFICULTY_COLORS[question.difficulty as Difficulty]}`}
            >
              {"★".repeat(
                { EASY: 1, MEDIUM_LOW: 2, MEDIUM: 3, MEDIUM_HIGH: 4, HARD: 5 }[
                  question.difficulty as Difficulty
                ]
              )}
              {" "}
              {DIFFICULTY_LABELS[question.difficulty as Difficulty]}
            </Badge>

            {!compact && !selection && (
              <div className="relative">
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-8 w-8"
                  onClick={() => {
                    if (pickerOpen) setPickerOpen(false);
                    else ensureAuthAndOpen();
                  }}
                  title="加入我的题集"
                >
                  <BookmarkPlus className="h-4 w-4" />
                </Button>

                {pickerOpen && (
                  <div className="absolute right-0 mt-2 w-76 max-w-[calc(100vw-2rem)] bg-background border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                    <div className="px-3 py-2 text-sm font-semibold border-b border-border/60">
                      加入到题集
                    </div>
                    <div className="p-3 space-y-2">
                      {pickerLoading ? (
                        <div className="text-sm text-muted-foreground">加载中...</div>
                      ) : collections.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          你还没有题集。可以先新建一个。
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-52 overflow-auto pr-1">
                          {collections.map((c) => (
                            <Button
                              key={c.id}
                              variant="secondary"
                              className="w-full justify-start"
                              disabled={addingToCollectionId === c.id}
                              onClick={() => addToCollection(c.id)}
                            >
                              {addingToCollectionId === c.id
                                ? "添加中..."
                                : c.name}
                            </Button>
                          ))}
                        </div>
                      )}

                      <div className="pt-1 space-y-2">
                        <Button
                          type="button"
                          className="w-full"
                          variant="outline"
                          onClick={createCollectionAndRefresh}
                        >
                          + 新建空题集
                        </Button>
                        <Link
                          href="/collections/new"
                          className="block text-center text-xs text-primary hover:underline"
                          onClick={() => setPickerOpen(false)}
                        >
                          批量选题建题集 →
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 来源信息 */}
        {question.source && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <BookOpen className="h-3 w-3" />
            {question.source}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 题目内容 */}
        <div className="rounded-lg bg-muted/40 p-4">
          <MathRenderer content={question.content} />
        </div>

        {/* 标签区域 */}
        {!compact && (
          <div className="space-y-2">
            {[
              { tags: knowledgeTags, type: "KNOWLEDGE" as TagType },
              { tags: methodTags, type: "METHOD" as TagType },
              { tags: thoughtTags, type: "THOUGHT" as TagType },
              { tags: sourceTags, type: "SOURCE" as TagType },
            ]
              .filter(({ tags }) => tags.length > 0)
              .map(({ tags, type }) => (
                <div key={type} className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground w-12 shrink-0">
                    {TAG_TYPE_LABELS[type]}
                  </span>
                  {tags.map(({ tag }) => (
                    <Link key={tag.id} href={`/tags/${tag.slug}`}>
                      <Badge
                        className={`text-xs cursor-pointer hover:opacity-80 ${TAG_TYPE_COLORS[type]}`}
                      >
                        <Tag className="h-2.5 w-2.5 mr-1" />
                        {tag.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              ))}
          </div>
        )}

        {/* 答案/解析切换 */}
        <div className="space-y-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAnswerVisible(!answerVisible)}
            className="w-full"
          >
            {answerVisible ? (
              <>
                <ChevronUp className="h-4 w-4" />
                收起答案与解析
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                查看答案与解析
              </>
            )}
          </Button>

          {answerVisible && (
            <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
              {/* 答案 */}
              <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-4">
                <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-2 uppercase tracking-wide">
                  标准答案
                </p>
                <MathRenderer content={question.answer} />
              </div>

              {/* 解析 */}
              {!compact && question.analysis && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 p-4">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-2 uppercase tracking-wide">
                    详细解析
                  </p>
                  <MathRenderer content={question.analysis} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* 底部操作 */}
        {!compact && (
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              {question.relationsFrom && question.relationsFrom.length > 0 && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {question.relationsFrom.length} 道相关题
                </span>
              )}
            </div>
            <Link href={`/questions/${question.slug}`}>
              <Button variant="ghost" size="sm" className="text-xs">
                查看详情
                <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
