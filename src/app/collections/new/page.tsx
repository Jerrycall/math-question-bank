"use client";

import React, { Suspense, useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, Filter, CheckSquare, Square } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QuestionCard, invalidateMyCollectionsCache } from "@/components/QuestionCard";
import { TagBrowser } from "@/components/TagBrowser";
import { Question, Tag, Difficulty, DIFFICULTY_LABELS } from "@/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";

/**
 * 新建题集，或向已有题集批量加题（URL: ?addTo=题集id）。
 */
function NewCollectionPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const addToIdRaw = searchParams.get("addTo")?.trim() ?? "";
  const addToId = addToIdRaw.length > 0 ? addToIdRaw : null;

  const returnToLogin = useMemo(() => {
    const q = searchParams.toString();
    return `${pathname || "/collections/new"}${q ? `?${q}` : ""}`;
  }, [pathname, searchParams]);

  const [collectionName, setCollectionName] = useState("");
  const [appendTarget, setAppendTarget] = useState<{ id: string; name: string } | null>(
    null
  );
  const [appendLoading, setAppendLoading] = useState(false);
  const [appendError, setAppendError] = useState<string | null>(null);
  const [orderedSelectedIds, setOrderedSelectedIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagSlugs, setSelectedTagSlugs] = useState<string[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [tagMode, setTagMode] = useState<"and" | "or">("or");
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

  const selectedSet = useMemo(
    () => new Set(orderedSelectedIds),
    [orderedSelectedIds]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!alive) return;
      if (!res.ok) {
        router.replace(`/login?returnTo=${encodeURIComponent(returnToLogin)}`);
        return;
      }
      setAuthChecked(true);
    })();
    return () => {
      alive = false;
    };
  }, [router, returnToLogin]);

  useEffect(() => {
    if (!authChecked || !addToId) {
      setAppendTarget(null);
      setAppendError(null);
      setAppendLoading(false);
      return;
    }
    let alive = true;
    setAppendLoading(true);
    setAppendError(null);
    setAppendTarget(null);
    (async () => {
      const res = await fetch(`/api/collections/${addToId}`, {
        credentials: "include",
      });
      if (!alive) return;
      setAppendLoading(false);
      if (!res.ok) {
        setAppendError("找不到该题集或无权访问，请从「我的题集」重新进入。");
        return;
      }
      const data = await res.json().catch(() => ({}));
      const c = data?.collection;
      if (c?.id && c?.name) {
        setAppendTarget({ id: c.id, name: c.name });
      } else {
        setAppendError("加载题集信息失败");
      }
    })();
    return () => {
      alive = false;
    };
  }, [authChecked, addToId]);

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
      if (appendTarget?.id) {
        params.set("excludeInCollection", appendTarget.id);
      }

      const res = await fetch(`/api/questions?${params}`, {
        credentials: "include",
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        setQuestions([]);
        setTotal(0);
        return;
      }
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
    appendTarget?.id,
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
    if (!authChecked) return;
    if (addToId && appendLoading) return;
    const timer = setTimeout(fetchQuestions, 300);
    return () => clearTimeout(timer);
  }, [fetchQuestions, authChecked, addToId, appendLoading]);

  const handleTagSelectionChange = (ids: string[]) => {
    setSelectedTagIds(ids);
    const selectedTags = allTagsFlat.filter((t) => ids.includes(t.id));
    setSelectedTagSlugs(selectedTags.map((t) => t.slug));
    setPage(1);
  };

  function toggleQuestion(id: string) {
    setOrderedSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const pageIds = useMemo(() => questions.map((q) => q.id), [questions]);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id));

  function selectAllOnPage() {
    setOrderedSelectedIds((prev) => {
      const existing = new Set(prev);
      const next = [...prev];
      for (const id of pageIds) {
        if (!existing.has(id)) {
          next.push(id);
          existing.add(id);
        }
      }
      return next;
    });
  }

  function clearPageSelection() {
    const pageSet = new Set(pageIds);
    setOrderedSelectedIds((prev) => prev.filter((id) => !pageSet.has(id)));
  }

  async function submitCollection() {
    if (orderedSelectedIds.length === 0) {
      alert("请至少勾选一道题目");
      return;
    }

    if (appendTarget) {
      setSubmitting(true);
      try {
        const addRes = await fetch(
          `/api/collections/${appendTarget.id}/questions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ questionIds: orderedSelectedIds }),
          }
        );
        if (!addRes.ok) {
          const data = await addRes.json().catch(() => ({}));
          alert(data?.error || "加入题集失败");
          return;
        }
        invalidateMyCollectionsCache();
        router.push(`/collections/${appendTarget.id}`);
      } catch (e) {
        console.error(e);
        alert("网络错误，请重试");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const name = collectionName.trim();
    if (!name) {
      alert("请填写题集名称");
      return;
    }
    if (name.length > 50) {
      alert("题集名称最多 50 字");
      return;
    }

    setSubmitting(true);
    try {
      const createRes = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
      });
      if (!createRes.ok) {
        const data = await createRes.json().catch(() => ({}));
        alert(data?.error || "创建题集失败");
        return;
      }
      const { collection } = await createRes.json();
      const id = collection?.id as string | undefined;
      if (!id) {
        alert("创建题集失败");
        return;
      }

      const addRes = await fetch(`/api/collections/${id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ questionIds: orderedSelectedIds }),
      });
      if (!addRes.ok) {
        const data = await addRes.json().catch(() => ({}));
        alert(data?.error || "录入题目失败");
        return;
      }

      invalidateMyCollectionsCache();
      router.push(`/collections/${id}`);
    } catch (e) {
      console.error(e);
      alert("网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  const difficulties: { value: Difficulty | ""; label: string }[] = [
    { value: "", label: "全部难度" },
    { value: "EASY", label: "⭐ 简单" },
    { value: "MEDIUM_LOW", label: "⭐⭐ 中低" },
    { value: "MEDIUM", label: "⭐⭐⭐ 中等" },
    { value: "MEDIUM_HIGH", label: "⭐⭐⭐⭐ 中高" },
    { value: "HARD", label: "⭐⭐⭐⭐⭐ 困难" },
  ];

  if (!authChecked) {
    return (
      <div className="text-sm text-muted-foreground py-12 text-center">验证登录中…</div>
    );
  }

  if (addToId && appendLoading) {
    return (
      <div className="text-sm text-muted-foreground py-12 text-center">
        加载题集信息…
      </div>
    );
  }

  const appendMode = Boolean(appendTarget);
  const appendBlocked = Boolean(addToId) && (!appendTarget || Boolean(appendError));

  return (
    <div className="flex flex-col gap-4">
      {addToId && appendError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive max-w-7xl mx-auto w-full">
          {appendError}{" "}
          <Link href="/collections" className="underline font-medium">
            返回我的题集
          </Link>
        </div>
      )}

      {/* 顶部：题集名 + 录入（sticky） */}
      <div className="sticky top-14 z-30 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4 max-w-7xl mx-auto">
          <div className="flex-1 space-y-1.5 min-w-0">
            {appendTarget ? (
              <>
                <label className="text-sm font-medium">向已有题集添加题目</label>
                <p className="text-sm text-muted-foreground rounded-md border border-border bg-muted/30 px-3 py-2">
                  「<span className="font-medium text-foreground">{appendTarget.name}</span>」
                  <Link
                    href={`/collections/${appendTarget.id}`}
                    className="ml-2 text-primary text-xs hover:underline"
                  >
                    查看题集
                  </Link>
                </p>
              </>
            ) : (
              <>
                <label className="text-sm font-medium">新题集名称</label>
                <Input
                  placeholder="例如：导数专题周练"
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  maxLength={50}
                />
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Badge variant="secondary" className="text-sm font-normal">
              已选 {orderedSelectedIds.length} 道
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOrderedSelectedIds([])}
              disabled={orderedSelectedIds.length === 0}
            >
              清空已选
            </Button>
            <Button
              type="button"
              size="lg"
              disabled={
                submitting ||
                orderedSelectedIds.length === 0 ||
                appendBlocked
              }
              onClick={submitCollection}
            >
              {submitting
                ? appendTarget
                  ? "加入中…"
                  : "录入中…"
                : appendTarget
                  ? "加入此题集"
                  : "录入题集"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 max-w-7xl mx-auto">
          {appendTarget
            ? "列表已隐藏本题集中已有的题目，仅显示还可加入的题；翻页勾选后点「加入此题集」会追加到末尾。"
            : "可翻页继续勾选，已选题目会保留；录入时按勾选顺序写入题集。"}
        </p>
      </div>

      <div className="flex gap-6">
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
                <p className="text-xs text-muted-foreground mt-0.5">与题库页相同</p>
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

            {selectedTagIds.length > 1 && (
              <div className="mb-4">
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
                    满足任一
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
                    同时满足
                  </button>
                </div>
              </div>
            )}

            <div className="mb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                难度
              </p>
              <div className="flex flex-wrap gap-1.5">
                {difficulties.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
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

            <div className="mb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                来源（字段）
              </p>
              <div className="space-y-2 px-0.5">
                <label className="block text-xs text-muted-foreground">
                  年份
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
                    placeholder="如：二模、一模…"
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

            <TagBrowser
              tags={tags}
              selectedIds={selectedTagIds}
              onSelectionChange={handleTagSelectionChange}
              showTypes={["KNOWLEDGE", "METHOD", "THOUGHT", "SOURCE"]}
              searchFilterTypes={["SOURCE"]}
            />
          </div>
        </aside>

        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-2 flex-1 min-w-0">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索题目..."
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
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={allPageSelected ? clearPageSelection : selectAllOnPage}
                disabled={questions.length === 0}
              >
                {allPageSelected ? (
                  <>
                    <Square className="h-4 w-4" />
                    取消本页
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-4 w-4" />
                    全选本页
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => router.push("/collections")}
              >
                返回题集列表
              </Button>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            本页 {questions.length} 道 · 共 {total} 道（可翻页累加选题）
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          ) : questions.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <p>暂无匹配题目</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {questions.map((q) => (
                <QuestionCard
                  key={q.id}
                  question={q}
                  selection={{
                    checked: selectedSet.has(q.id),
                    onChange: () => toggleQuestion(q.id),
                  }}
                />
              ))}
            </div>
          )}

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
    </div>
  );
}

export default function NewCollectionPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-muted-foreground py-12 text-center">
          加载中…
        </div>
      }
    >
      <NewCollectionPageContent />
    </Suspense>
  );
}
