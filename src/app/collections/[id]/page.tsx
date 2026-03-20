"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QuestionCard, type QuestionCardQuestion } from "@/components/QuestionCard";
import { Loader2, Trash2, ListPlus, ArrowUp, ArrowDown } from "lucide-react";

type CollectionQuestionResponse = {
  collection: {
    id: string;
    name: string;
    createdAt: string | Date;
    questionsCount: number;
    questions: (QuestionCardQuestion & {
      sortOrder?: number;
      pageBreakBefore?: boolean;
    })[];
  };
};

export default function CollectionDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const collectionId = params?.id;

  const [collection, setCollection] = useState<CollectionQuestionResponse["collection"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printAnswerSpace, setPrintAnswerSpace] = useState(true);
  const [draggingQuestionId, setDraggingQuestionId] = useState<string | null>(null);
  const [dragOverQuestionId, setDragOverQuestionId] = useState<string | null>(null);

  async function load() {
    if (!collectionId) return;
    setLoading(true);
    setError(null);
    try {
      const meRes = await fetch("/api/auth/me", { credentials: "include" });
      if (!meRes.ok) {
        router.push(`/login?returnTo=/collections/${collectionId}`);
        return;
      }

      const res = await fetch(`/api/collections/${collectionId}`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "加载失败");
        return;
      }
      setCollection(data?.collection ?? null);
    } catch (e) {
      console.error("load collection detail error:", e);
      setError("网络错误，请刷新重试");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collectionId]);

  async function setPageBreakBefore(
    questionId: string,
    pageBreakBefore: boolean
  ) {
    if (!collectionId) return;
    setBusy(`pb:${questionId}`);
    try {
      const res = await fetch(
        `/api/collections/${collectionId}/questions/${questionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ pageBreakBefore }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || "更新失败");
        return;
      }
      setCollection((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          questions: prev.questions.map((q) =>
            q.id === questionId ? { ...q, pageBreakBefore } : q
          ),
        };
      });
    } catch (e) {
      console.error("setPageBreakBefore error:", e);
      alert("更新失败");
    } finally {
      setBusy(null);
    }
  }

  async function removeQuestion(questionId: string) {
    if (!collectionId) return;
    setBusy(questionId);
    try {
      const res = await fetch(
        `/api/collections/${collectionId}/questions/${questionId}`,
        { method: "DELETE", credentials: "include" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || "移除失败");
        return;
      }
      await load();
    } catch (e) {
      console.error("removeQuestion error:", e);
      alert("移除失败");
    } finally {
      setBusy(null);
    }
  }

  async function moveQuestion(questionId: string, direction: "up" | "down") {
    if (!collectionId || !collection) return;
    const idx = collection.questions.findIndex((q) => q.id === questionId);
    if (idx < 0) return;
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= collection.questions.length) return;

    const current = collection.questions[idx];
    const target = collection.questions[targetIdx];
    const currentOrder = current.sortOrder ?? idx * 10;
    const targetOrder = target.sortOrder ?? targetIdx * 10;
    setBusy(`mv:${questionId}`);
    try {
      const [resA, resB] = await Promise.all([
        fetch(`/api/collections/${collectionId}/questions/${current.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sortOrder: targetOrder }),
        }),
        fetch(`/api/collections/${collectionId}/questions/${target.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sortOrder: currentOrder }),
        }),
      ]);
      if (!resA.ok || !resB.ok) {
        const da = await resA.json().catch(() => ({}));
        const db = await resB.json().catch(() => ({}));
        alert(da?.error || db?.error || "调整顺序失败");
        return;
      }
      await load();
    } catch (e) {
      console.error("moveQuestion error:", e);
      alert("调整顺序失败");
    } finally {
      setBusy(null);
    }
  }

  async function reorderQuestionsByIds(nextIds: string[]) {
    if (!collectionId || !collection) return;
    const map = new Map(collection.questions.map((q) => [q.id, q]));
    const reordered = nextIds
      .map((id) => map.get(id))
      .filter((q): q is NonNullable<typeof q> => Boolean(q))
      .map((q, idx) => ({ ...q, sortOrder: idx }));
    const prev = collection.questions;
    setCollection({ ...collection, questions: reordered });
    setBusy("reorder");
    try {
      const res = await fetch(`/api/collections/${collectionId}/questions/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ questionIds: nextIds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data?.error || "保存顺序失败");
        setCollection({ ...collection, questions: prev });
      }
    } catch (e) {
      console.error("reorderQuestionsByIds error:", e);
      alert("保存顺序失败");
      setCollection({ ...collection, questions: prev });
    } finally {
      setBusy(null);
      setDraggingQuestionId(null);
      setDragOverQuestionId(null);
    }
  }

  async function handleDropToQuestion(dropQuestionId: string) {
    if (!collection || !draggingQuestionId || draggingQuestionId === dropQuestionId) {
      setDraggingQuestionId(null);
      setDragOverQuestionId(null);
      return;
    }
    const ids = collection.questions.map((q) => q.id);
    const from = ids.indexOf(draggingQuestionId);
    const to = ids.indexOf(dropQuestionId);
    if (from < 0 || to < 0 || from === to) {
      setDraggingQuestionId(null);
      setDragOverQuestionId(null);
      return;
    }
    const nextIds = [...ids];
    const [moved] = nextIds.splice(from, 1);
    nextIds.splice(to, 0, moved);
    await reorderQuestionsByIds(nextIds);
  }

  function exportPdf(showAnswers: boolean) {
    if (!collectionId) return;
    const qs = new URLSearchParams();
    qs.set("showAnswers", showAnswers ? "1" : "0");
    qs.set("answerSpace", printAnswerSpace ? "1" : "0");
    window.open(
      `/print/${collectionId}?${qs.toString()}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  const title = useMemo(() => "题集详情", []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{title}</h1>
          {collection && (
            <div className="text-sm text-muted-foreground">
              {collection.name} · 共 <b>{collection.questionsCount}</b> 题
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 items-end sm:items-stretch sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none order-last sm:order-none mr-auto sm:mr-0">
            <input
              type="checkbox"
              className="rounded border-input"
              checked={printAnswerSpace}
              onChange={(e) => setPrintAnswerSpace(e.target.checked)}
            />
            导出时在每题后附答题区（稿纸线）
          </label>
          <div className="flex gap-2 flex-wrap justify-end">
            <Link href={`/collections/new?addTo=${collectionId}`}>
              <Button variant="default" className="gap-1.5">
                <ListPlus className="h-4 w-4" />
                批量加题
              </Button>
            </Link>
            <Link href="/collections">
              <Button variant="outline">返回题集列表</Button>
            </Link>
            <Button onClick={() => exportPdf(false)} variant="secondary">
              导出 PDF（只含题目）
            </Button>
            <Button onClick={() => exportPdf(true)} variant="outline">
              导出 PDF（含答案/解析）
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground max-w-xl">
          每道题右侧可勾选「打印时换页」：导出 PDF 时会在该题<strong>之前</strong>强制分页（第 1 题无效）。适合把大题拆开或留空白页。
        </p>
        <p className="text-xs text-muted-foreground max-w-xl">
          支持拖拽排序：按住题卡区域拖到目标位置即可保存；也可使用右侧上移/下移按钮微调。
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          加载中...
        </div>
      )}
      {error && <div className="text-sm text-destructive">{error}</div>}

      {!loading && collection && collection.questions.length === 0 && (
        <div className="text-sm text-muted-foreground">这个题集还没有题目。</div>
      )}

      {!loading && collection && collection.questions.length > 0 && (
        <div className="space-y-4">
          {collection.questions.map((q, idx) => (
            <div
              key={q.id}
              className={`flex gap-3 items-start rounded-md transition-colors ${
                dragOverQuestionId === q.id ? "bg-muted/50" : ""
              }`}
              draggable={!busy}
              onDragStart={() => setDraggingQuestionId(q.id)}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggingQuestionId && draggingQuestionId !== q.id) {
                  setDragOverQuestionId(q.id);
                }
              }}
              onDragLeave={() => {
                if (dragOverQuestionId === q.id) setDragOverQuestionId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                void handleDropToQuestion(q.id);
              }}
              onDragEnd={() => {
                setDraggingQuestionId(null);
                setDragOverQuestionId(null);
              }}
            >
              <div className="flex-1 min-w-0">
                <QuestionCard question={q} compact />
              </div>
              <div className="shrink-0 pt-2 flex flex-col gap-2 items-end">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    className="rounded border-input shrink-0"
                    checked={!!q.pageBreakBefore}
                    disabled={busy === `pb:${q.id}` || busy === q.id}
                    onChange={(e) =>
                      setPageBreakBefore(q.id, e.target.checked)
                    }
                  />
                  打印换页
                </label>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  disabled={idx === 0 || !!busy}
                  onClick={() => moveQuestion(q.id, "up")}
                  title="上移"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  disabled={idx === collection.questions.length - 1 || !!busy}
                  onClick={() => moveQuestion(q.id, "down")}
                  title="下移"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  disabled={busy === q.id || busy === `pb:${q.id}`}
                  onClick={() => removeQuestion(q.id)}
                  title="从题集移除"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

