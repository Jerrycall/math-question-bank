"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Search, Filter, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QuestionCard } from "@/components/QuestionCard";
import { TagBrowser } from "@/components/TagBrowser";
import { Question, Tag, Difficulty, DIFFICULTY_LABELS } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagSlugs, setSelectedTagSlugs] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<"and" | "or">("or"); // 并集 | 交集
  const [searchQuery, setSearchQuery] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sourceYear, setSourceYear] = useState<string>("");
  const [sourceQ, setSourceQ] = useState("");
  const [sourceYears, setSourceYears] = useState<number[]>([]);

  const allTagsFlat = useMemo(() => {
    const out: Tag[] = [];
    const walk = (ts: Tag[]) => {
      for (const t of ts) {
        out.push(t);
        if (t.children?.length) walk(t.children);
      }
    };
    walk(tags);
    return out;
  }, [tags]);

  const fetchTags = useCallback(async () => {
    try {
      const res = await fetch("/api/tags?tree=true&withCount=true");
      const text = await res.text();
      const data = text ? JSON.parse(text) : [];
      setTags(Array.isArray(data) ? data : []);
    } catch {
      setTags([]);
    }
  }, []);

  const fetchQuestions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      if (difficulty) params.set("difficulty", difficulty);
      if (sourceYear) params.set("sourceYear", sourceYear);
      if (sourceQ.trim()) params.set("sourceQ", sourceQ.trim());
      selectedTagSlugs.forEach((s) => params.append("tags", s));
      params.set("tagMode", tagMode);
      params.set("page", String(page));
      params.set("limit", "12");

      const res = await fetch(`/api/questions?${params}`);
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      setQuestions(data.questions ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setQuestions([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [
    searchQuery,
    difficulty,
    selectedTagSlugs,
    tagMode,
    page,
    sourceYear,
    sourceQ,
  ]);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  useEffect(() => {
    fetch("/api/questions/meta")
      .then((r) => r.json())
      .then((d) => setSourceYears(Array.isArray(d?.sourceYears) ? d.sourceYears : []))
      .catch(() => setSourceYears([]));
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchQuestions, 300);
    return () => clearTimeout(timer);
  }, [fetchQuestions]);

  const handleTagSelectionChange = (ids: string[]) => {
    setSelectedTagIds(ids);
    const selectedTags = allTagsFlat.filter((t) => ids.includes(t.id));
    setSelectedTagSlugs(selectedTags.map((t) => t.slug));
    setPage(1);
  };

  const difficulties: { value: Difficulty | ""; label: string }[] = [
    { value: "", label: "全部难度" },
    { value: "EASY", label: "⭐ 简单" },
    { value: "MEDIUM_LOW", label: "⭐⭐ 中低" },
    { value: "MEDIUM", label: "⭐⭐⭐ 中等" },
    { value: "MEDIUM_HIGH", label: "⭐⭐⭐⭐ 中高" },
    { value: "HARD", label: "⭐⭐⭐⭐⭐ 困难" },
  ];

  return (
    <div className="flex gap-6">
      {/* 侧边栏：标签筛选 */}
      <aside
        className={cn(
          "w-64 shrink-0 hidden lg:block",
          sidebarOpen && "block fixed inset-y-0 left-0 z-40 bg-background p-4 pt-16 border-r w-64"
        )}
      >
        <div className="sticky top-20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-sm">筛选条件</h3>
              <p className="text-xs text-muted-foreground mt-0.5">点击选中，再次点击取消</p>
            </div>
            {(selectedTagIds.length > 0 ||
              sourceYear ||
              sourceQ.trim()) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  setSelectedTagIds([]);
                  setSelectedTagSlugs([]);
                  setSourceYear("");
                  setSourceQ("");
                  setPage(1);
                }}
              >
                清除
              </Button>
            )}
          </div>

          {/* 标签逻辑：交集 / 并集 */}
          {selectedTagIds.length > 1 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                多标签
              </p>
              <div className="flex rounded-lg border border-border p-0.5 bg-muted/30">
                <button
                  type="button"
                  onClick={() => {
                    setTagMode("or");
                    setPage(1);
                  }}
                  className={cn(
                    "flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                    tagMode === "or"
                      ? "bg-background shadow text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  满足任一（并集）
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTagMode("and");
                    setPage(1);
                  }}
                  className={cn(
                    "flex-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                    tagMode === "and"
                      ? "bg-background shadow text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  同时满足（交集）
                </button>
              </div>
            </div>
          )}

          {/* 已选条件（在难度上方展示） */}
          {(selectedTagIds.length > 0 ||
            difficulty ||
            sourceYear ||
            sourceQ.trim()) && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                已选
              </p>
              <div className="flex flex-wrap gap-1.5">
                {allTagsFlat
                  .filter((t) => selectedTagIds.includes(t.id))
                  .map((t) => (
                    <Badge
                      key={t.id}
                      variant="secondary"
                      className="text-xs font-normal cursor-default"
                    >
                      {t.name}
                    </Badge>
                  ))}
                {selectedTagIds.length > 1 && (
                  <Badge variant="outline" className="text-xs font-normal cursor-default">
                    {tagMode === "and" ? "交集" : "并集"}
                  </Badge>
                )}
                {difficulty && (
                  <Badge variant="outline" className="text-xs font-normal cursor-default">
                    {DIFFICULTY_LABELS[difficulty]}
                  </Badge>
                )}
                {sourceYear ? (
                  <Badge variant="outline" className="text-xs font-normal cursor-default">
                    年份 {sourceYear}
                  </Badge>
                ) : null}
                {sourceQ.trim() ? (
                  <Badge variant="outline" className="text-xs font-normal cursor-default">
                    来源含「{sourceQ.trim()}」
                  </Badge>
                ) : null}
              </div>
            </div>
          )}

          {/* 难度筛选 */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              难度
            </p>
            <div className="flex flex-wrap gap-1.5">
              {difficulties.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => {
                    setDifficulty(value);
                    setPage(1);
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
                    difficulty === value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:bg-muted"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 按题目表字段筛选来源（可与下方来源标签同时使用） */}
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              来源（字段）
            </p>
            <div className="space-y-2 px-0.5">
              <label className="block text-xs text-muted-foreground">
                年份（sourceYear）
                <select
                  className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                  value={sourceYear}
                  onChange={(e) => {
                    setSourceYear(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">不限</option>
                  {sourceYears.map((y) => (
                    <option key={y} value={String(y)}>
                      {y} 年
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                来源文字包含
                <Input
                  placeholder="如：二模、一模、松江…"
                  value={sourceQ}
                  onChange={(e) => {
                    setSourceQ(e.target.value);
                    setPage(1);
                  }}
                  className="mt-1 h-9 text-sm"
                />
              </label>
            </div>
          </div>

          {/* 标签树 */}
          <TagBrowser
            tags={tags}
            selectedIds={selectedTagIds}
            onSelectionChange={handleTagSelectionChange}
            showTypes={["KNOWLEDGE", "METHOD", "THOUGHT", "SOURCE"]}
            searchFilterTypes={["SOURCE"]}
          />
        </div>
      </aside>

      {/* 主内容 */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* 搜索栏 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索题目、知识点..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Filter className="h-4 w-4" />
          </Button>
          <Link href="/learn">
            <Button className="gap-2 shrink-0">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:block">添加题目</span>
            </Button>
          </Link>
        </div>

        {/* 结果统计 */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>共 {total} 道题目</span>
          {difficulty && (
            <Badge variant="outline" className="text-xs">
              {DIFFICULTY_LABELS[difficulty as Difficulty]}
            </Badge>
          )}
        </div>

        {/* 题目列表 */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-48 rounded-xl bg-muted animate-pulse"
              />
            ))}
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <BookOpenIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>暂无匹配题目</p>
            <p className="text-sm mt-1">试试调整筛选条件或搜索关键词</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {questions.map((q) => (
              <QuestionCard key={q.id} question={q} />
            ))}
          </div>
        )}

        {/* 分页 */}
        {total > 12 && (
          <div className="flex justify-center gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              上一页
            </Button>
            <span className="flex items-center text-sm text-muted-foreground px-2">
              第 {page} / {Math.ceil(total / 12)} 页
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= Math.ceil(total / 12)}
              onClick={() => setPage((p) => p + 1)}
            >
              下一页
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function BookOpenIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
      />
    </svg>
  );
}
