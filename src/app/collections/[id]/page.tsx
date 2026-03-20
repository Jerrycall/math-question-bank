"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QuestionCard, type QuestionCardQuestion } from "@/components/QuestionCard";
import { MathRenderer } from "@/components/QuestionCard/MathRenderer";
import { Loader2, Trash2, ListPlus, ArrowUp, ArrowDown, Pencil, Check } from "lucide-react";
import type { TagType } from "@/types";

type CollectionQuestionResponse = {
  collection: {
    id: string;
    name: string;
    introType?: string | null;
    introTitle?: string | null;
    introContent?: string | null;
    createdAt: string | Date;
    questionsCount: number;
    questions: (QuestionCardQuestion & {
      sortOrder?: number;
      pageBreakBefore?: boolean;
    })[];
  };
};

type IntroTag = {
  id: string;
  name: string;
  description?: string | null;
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
  const [introType, setIntroType] = useState<Extract<TagType, "KNOWLEDGE" | "METHOD">>(
    "KNOWLEDGE"
  );
  const [introTags, setIntroTags] = useState<IntroTag[]>([]);
  const [selectedIntroTagIds, setSelectedIntroTagIds] = useState<string[]>([]);
  const [introTagKeyword, setIntroTagKeyword] = useState("");
  const [introTitle, setIntroTitle] = useState("导学：知识点与方法");
  const [introContent, setIntroContent] = useState("");
  const [introSavedAt, setIntroSavedAt] = useState<string>("");
  const [introEditing, setIntroEditing] = useState(false);
  const [draggingQuestionId, setDraggingQuestionId] = useState<string | null>(null);
  const [dragOverQuestionId, setDragOverQuestionId] = useState<string | null>(null);

  async function loadIntroTags(type: Extract<TagType, "KNOWLEDGE" | "METHOD">) {
    try {
      const res = await fetch(`/api/tags?type=${type}`, { credentials: "include" });
      const data = await res.json().catch(() => []);
      const list = Array.isArray(data)
        ? data.map((t) => ({
            id: String(t?.id ?? ""),
            name: String(t?.name ?? ""),
            description:
              typeof t?.description === "string" ? t.description : (t?.description ?? null),
          }))
        : [];
      setIntroTags(list.filter((t) => t.id && t.name));
      setSelectedIntroTagIds([]);
      setIntroTagKeyword("");
    } catch {
      setIntroTags([]);
      setSelectedIntroTagIds([]);
      setIntroTagKeyword("");
    }
  }

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
      const c = data?.collection ?? null;
      setCollection(c);
      if (c) {
        const loadedType =
          c.introType === "METHOD" || c.introType === "KNOWLEDGE"
            ? c.introType
            : "KNOWLEDGE";
        setIntroType(loadedType);
        setIntroTitle(
          typeof c.introTitle === "string" && c.introTitle.trim()
            ? c.introTitle
            : loadedType === "KNOWLEDGE"
            ? "导学：本题集核心知识点"
            : "导学：本题集核心方法"
        );
        setIntroContent(
          typeof c.introContent === "string" ? c.introContent : ""
        );
      }
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

  useEffect(() => {
    void loadIntroTags(introType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introType]);

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
    if (introContent.trim()) {
      const introBase64 = btoa(unescape(encodeURIComponent(introContent)));
      const titleBase64 = btoa(unescape(encodeURIComponent(introTitle.trim() || "导学")));
      qs.set("introType", introType);
      qs.set("introTitleB64", titleBase64);
      qs.set("introContentB64", introBase64);
    }
    window.open(
      `/print/${collectionId}?${qs.toString()}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function toggleIntroTag(id: string) {
    setSelectedIntroTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function fillIntroFromSelectedTags() {
    const selected = introTags.filter((t) => selectedIntroTagIds.includes(t.id));
    const sectionTitle = introType === "KNOWLEDGE" ? "知识点导学" : "方法导学";
    const summaryLine =
      introType === "KNOWLEDGE"
        ? "本节先梳理核心知识点，再通过题目训练巩固。"
        : "本节先明确解题方法，再通过题目训练形成稳定套路。";
    const blocks = selected.map((t, idx) => {
      const desc = (t.description || "").trim() || "（暂无说明）";
      return [
        `### ${idx + 1}. ${t.name}`,
        "",
        `**核心说明**`,
        "",
        desc,
        "",
        `**应用提醒**`,
        "",
        "- 先识别题型与条件，再选择对应思路。",
        "- 计算前先写关键关系式，避免盲算。",
      ].join("\n");
    });
    setIntroContent(
      [
        `## ${sectionTitle}`,
        "",
        summaryLine,
        "",
        "---",
        "",
        ...blocks,
      ].join("\n")
    );
  }

  const filteredIntroTags = useMemo(() => {
    const kw = introTagKeyword.trim().toLowerCase();
    if (!kw) return introTags;
    return introTags.filter((t) => t.name.toLowerCase().includes(kw));
  }, [introTags, introTagKeyword]);

  async function saveIntro() {
    if (!collectionId) return;
    setBusy("intro-save");
    setIntroSavedAt("");
    try {
      const res = await fetch(`/api/collections/${collectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          introType,
          introTitle: introTitle.trim(),
          introContent,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "导学保存失败");
        return;
      }
      setIntroSavedAt(new Date().toLocaleTimeString("zh-CN"));
    } catch (e) {
      console.error("saveIntro error:", e);
      alert("导学保存失败");
    } finally {
      setBusy(null);
    }
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

      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="text-sm font-semibold">讲义前置导学（导出第一页）</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={introType === "KNOWLEDGE" ? "default" : "outline"}
            onClick={() => setIntroType("KNOWLEDGE")}
          >
            选择知识点
          </Button>
          <Button
            type="button"
            size="sm"
            variant={introType === "METHOD" ? "default" : "outline"}
            onClick={() => setIntroType("METHOD")}
          >
            选择方法
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={fillIntroFromSelectedTags}
            disabled={selectedIntroTagIds.length === 0}
          >
            生成到下方可编辑内容
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={saveIntro}
            disabled={busy === "intro-save"}
          >
            {busy === "intro-save" ? "保存中..." : "保存导学到题集"}
          </Button>
          {introSavedAt ? (
            <span className="text-xs text-muted-foreground">已保存：{introSavedAt}</span>
          ) : null}
        </div>
        <div className="max-h-48 overflow-auto rounded border p-2">
          <input
            className="w-full rounded border border-input bg-background px-2 py-1 text-xs mb-2"
            value={introTagKeyword}
            onChange={(e) => setIntroTagKeyword(e.target.value)}
            placeholder={`检索${introType === "KNOWLEDGE" ? "知识点" : "方法"}（支持模糊匹配）`}
          />
          {filteredIntroTags.length === 0 ? (
            <p className="text-xs text-muted-foreground">当前类型暂无可选标签</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {filteredIntroTags.map((tag) => (
                <label key={tag.id} className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="rounded border-input"
                    checked={selectedIntroTagIds.includes(tag.id)}
                    onChange={() => toggleIntroTag(tag.id)}
                  />
                  <span className="truncate">{tag.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <input
          className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
          value={introTitle}
          onChange={(e) => setIntroTitle(e.target.value)}
          placeholder="导学标题（导出后显示在最前）"
        />
        <div className="rounded border border-input bg-background overflow-hidden">
          {introEditing ? (
            <div className="relative">
              <textarea
                className="w-full min-h-64 px-3 py-2 text-sm font-mono bg-background resize-y focus:outline-none"
                value={introContent}
                onChange={(e) => setIntroContent(e.target.value)}
                placeholder="在此输入 Markdown 内容，支持 $公式$、**加粗**、## 标题、- 列表等"
                autoFocus
              />
              <div className="flex justify-end px-3 pb-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setIntroEditing(false)}
                  className="gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  完成编辑
                </Button>
              </div>
            </div>
          ) : (
            <div className="relative group min-h-16">
              {introContent.trim() ? (
                <div className="px-3 py-3 text-sm">
                  <MathRenderer content={introContent} />
                </div>
              ) : (
                <p className="px-3 py-3 text-sm text-muted-foreground italic">
                  暂无导学内容，点击右上角"编辑"添加（支持 Markdown 与数学公式）
                </p>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setIntroEditing(true)}
                className="absolute top-2 right-2 gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Pencil className="h-3.5 w-3.5" />
                编辑
              </Button>
            </div>
          )}
        </div>
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

