"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { QuestionCard, type QuestionCardQuestion } from "@/components/QuestionCard";
import { MathRenderer } from "@/components/QuestionCard/MathRenderer";
import { Loader2, Trash2, ListPlus, ArrowUp, ArrowDown } from "lucide-react";
import type { TagType } from "@/types";

type PrintQuestionGapPreset = "COMPACT" | "NORMAL" | "RELAXED" | "LOOSE";

type CollectionQuestionResponse = {
  collection: {
    id: string;
    name: string;
    introType?: string | null;
    introTitle?: string | null;
    introContent?: string | null;
    printQuestionGap?: string | null;
    createdAt: string | Date;
    questionsCount: number;
    questions: (QuestionCardQuestion & {
      sortOrder?: number;
      pageBreakBefore?: boolean;
      printGapAfter?: string | null;
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
  const [printQuestionGap, setPrintQuestionGap] =
    useState<PrintQuestionGapPreset>("NORMAL");
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
  const introTextareaRef = useRef<HTMLTextAreaElement>(null);
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
        const g = (c.printQuestionGap || "NORMAL").toUpperCase();
        setPrintQuestionGap(
          g === "COMPACT" || g === "RELAXED" || g === "LOOSE" ? g : "NORMAL"
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

  function printGapSelectValue(v: string | null | undefined): string {
    if (v == null || v === "") return "";
    const u = v.toUpperCase();
    if (u === "COMPACT" || u === "NORMAL" || u === "RELAXED" || u === "LOOSE") {
      return u;
    }
    return "";
  }

  async function setQuestionPrintGapAfter(questionId: string, value: string) {
    if (!collectionId) return;
    setBusy(`gap:${questionId}`);
    try {
      const body =
        value === "" ? { printGapAfter: null } : { printGapAfter: value };
      const res = await fetch(
        `/api/collections/${collectionId}/questions/${questionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(body),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "更新间距失败");
        return;
      }
      const nextGap: string | null =
        value === "" ? null : value.toUpperCase();
      setCollection((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          questions: prev.questions.map((q) =>
            q.id === questionId ? { ...q, printGapAfter: nextGap } : q
          ),
        };
      });
    } catch (e) {
      console.error("setQuestionPrintGapAfter error:", e);
      alert("更新间距失败");
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

  async function exportPdf(showAnswers: boolean) {
    if (!collectionId) return;
    const saved = await saveIntro({ silentSuccess: true });
    if (!saved) return;
    const qs = new URLSearchParams();
    qs.set("showAnswers", showAnswers ? "1" : "0");
    qs.set("answerSpace", printAnswerSpace ? "1" : "0");
    qs.set("qGap", printQuestionGap);
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

  async function saveIntro(options?: { silentSuccess?: boolean }): Promise<boolean> {
    if (!collectionId) return false;
    setBusy("intro-save");
    if (!options?.silentSuccess) {
      setIntroSavedAt("");
    }
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
        return false;
      }
      if (!options?.silentSuccess) {
        setIntroSavedAt(new Date().toLocaleTimeString("zh-CN"));
      }
      return true;
    } catch (e) {
      console.error("saveIntro error:", e);
      alert("导学保存失败");
      return false;
    } finally {
      setBusy(null);
    }
  }

  /** 删除整个题集（仅删除题集与组卷关系，题库里的题目仍保留） */
  async function deleteCollection() {
    if (!collectionId || !collection) return;
    const name = collection.name.trim() || "此题集";
    if (
      !confirm(
        `确定删除题集「${name}」？\n删除后无法恢复；题库中的题目不会被删除，只是不再出现在本题集里。`
      )
    ) {
      return;
    }
    setBusy("delete-collection");
    try {
      const res = await fetch(`/api/collections/${collectionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "删除题集失败");
        return;
      }
      router.push("/collections");
    } catch (e) {
      console.error("deleteCollection error:", e);
      alert("删除题集失败");
    } finally {
      setBusy(null);
    }
  }

  async function persistPrintQuestionGap(next: PrintQuestionGapPreset) {
    if (!collectionId) return;
    setPrintQuestionGap(next);
    setBusy("print-gap");
    try {
      const res = await fetch(`/api/collections/${collectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ printQuestionGap: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "题间距保存失败");
        await load();
        return;
      }
    } catch (e) {
      console.error("persistPrintQuestionGap error:", e);
      alert("题间距保存失败");
      await load();
    } finally {
      setBusy(null);
    }
  }

  /** 一键删除本题集已保存的导学；导出讲义将不再包含该块 */
  async function clearIntro() {
    if (!collectionId) return;
    if (
      !confirm(
        "确定清除本题集的「讲义前置导学」？\n清除并保存后，导出 PDF 将不再包含导学部分，可随时重新编辑保存。"
      )
    ) {
      return;
    }
    setBusy("intro-clear");
    setIntroSavedAt("");
    try {
      const res = await fetch(`/api/collections/${collectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          introType: "",
          introTitle: "",
          introContent: "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "清除导学失败");
        return;
      }
      setIntroContent("");
      setIntroType("KNOWLEDGE");
      setIntroTitle("导学：本题集核心知识点");
      setSelectedIntroTagIds([]);
      setIntroEditing(false);
      setIntroSavedAt(new Date().toLocaleTimeString("zh-CN"));
    } catch (e) {
      console.error("clearIntro error:", e);
      alert("清除导学失败");
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
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 text-sm order-last sm:order-none mr-auto sm:mr-0 w-full sm:w-auto">
            <label className="flex items-center gap-2 text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                className="rounded border-input"
                checked={printAnswerSpace}
                onChange={(e) => setPrintAnswerSpace(e.target.checked)}
              />
              导出时在每题后附答题区（稿纸线）
            </label>
            <label className="flex items-center gap-2 text-muted-foreground">
              <span className="shrink-0">默认题间间距</span>
              <select
                className="rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground min-w-[7rem]"
                value={printQuestionGap}
                disabled={busy === "print-gap"}
                onChange={(e) =>
                  void persistPrintQuestionGap(e.target.value as PrintQuestionGapPreset)
                }
                title="未在单题下单独设置时，相邻两题之间的垂直间距；可在每题卡片下「与下一题间距」覆盖"
              >
                <option value="COMPACT">紧凑</option>
                <option value="NORMAL">默认</option>
                <option value="RELAXED">宽松</option>
                <option value="LOOSE">很宽</option>
              </select>
            </label>
          </div>
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
            <Button
              type="button"
              variant="outline"
              className="text-destructive border-destructive/40 hover:bg-destructive/10"
              disabled={!!busy || !collection}
              onClick={() => void deleteCollection()}
            >
              {busy === "delete-collection" ? "删除中…" : "删除题集"}
            </Button>
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
          每两题之间的竖直间距：顶部「默认题间间距」可统一设置；也可在题目卡片下方「与下一题间距」对<strong>相邻两题</strong>单独设置（末题无此项）。
        </p>
        <p className="text-xs text-muted-foreground max-w-xl">
          支持拖拽排序：按住题卡区域拖到目标位置即可保存；也可使用右侧上移/下移按钮微调。
        </p>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">讲义前置导学（导出第一页）</h3>
          <p className="text-xs text-muted-foreground">
            不需要导学时，点击下方「清除导学」；或把正文删空后点「保存导学到题集」也可以。
          </p>
        </div>
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
            onClick={() => void saveIntro()}
            disabled={busy === "intro-save" || busy === "intro-clear"}
          >
            {busy === "intro-save" ? "保存中..." : "保存导学到题集"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="text-destructive border-destructive/40 hover:bg-destructive/10"
            onClick={() => void clearIntro()}
            disabled={
              busy === "intro-save" ||
              busy === "intro-clear" ||
              (!introContent.trim() &&
                !collection?.introContent?.trim() &&
                !collection?.introTitle?.trim() &&
                !collection?.introType)
            }
          >
            {busy === "intro-clear" ? "清除中…" : "清除导学"}
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
        {/* 点击渲染区切入编辑，点击外部自动切回渲染 */}
        <div className="rounded border border-input bg-background overflow-hidden">
          {introEditing ? (
            <textarea
              ref={introTextareaRef}
              className="w-full min-h-64 px-3 py-3 text-sm font-mono bg-background resize-y focus:outline-none leading-relaxed"
              value={introContent}
              onChange={(e) => {
                setIntroContent(e.target.value);
                // 自动撑高
                const el = e.target;
                el.style.height = "auto";
                el.style.height = el.scrollHeight + "px";
              }}
              onBlur={() => setIntroEditing(false)}
              placeholder="支持 Markdown：## 标题、**加粗**、- 列表；数学公式用 $...$（行内）或 $$...$$（块）"
            />
          ) : (
            <div
              className="px-3 py-3 text-sm cursor-text min-h-16"
              onClick={() => {
                setIntroEditing(true);
                // 下一帧 focus，确保 textarea 已渲染
                setTimeout(() => {
                  const el = introTextareaRef.current;
                  if (el) {
                    el.style.height = "auto";
                    el.style.height = el.scrollHeight + "px";
                    el.focus();
                    el.setSelectionRange(el.value.length, el.value.length);
                  }
                }, 0);
              }}
            >
              {introContent.trim() ? (
                <MathRenderer content={introContent} />
              ) : (
                <p className="text-muted-foreground italic select-none">
                  点击此处编辑导学内容（支持 Markdown 与数学公式）
                </p>
              )}
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
              <div className="flex-1 min-w-0 space-y-2">
                <QuestionCard question={q} compact />
                {idx < collection.questions.length - 1 ? (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pl-0.5">
                    <span className="shrink-0">
                      与第 {idx + 2} 题间距
                    </span>
                    <select
                      className="rounded border border-input bg-background px-2 py-1 text-xs text-foreground min-w-[6.5rem]"
                      value={printGapSelectValue(q.printGapAfter)}
                      disabled={!!busy}
                      title="仅影响本题与下一题之间；选「跟随默认」则用上方默认题间间距"
                      onChange={(e) =>
                        void setQuestionPrintGapAfter(q.id, e.target.value)
                      }
                    >
                      <option value="">跟随默认</option>
                      <option value="COMPACT">紧凑</option>
                      <option value="NORMAL">默认</option>
                      <option value="RELAXED">宽松</option>
                      <option value="LOOSE">很宽</option>
                    </select>
                  </div>
                ) : null}
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

