"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, Network, Loader2 } from "lucide-react";
import { QuestionCard } from "@/components/QuestionCard";
import { Badge } from "@/components/ui/badge";
import { TAG_TYPE_COLORS, TAG_TYPE_LABELS } from "@/types";

type TagWithQuestions = {
  id: string;
  name: string;
  slug: string;
  type: string;
  description?: string | null;
  parent?: { id: string; name: string; slug: string } | null;
  children: Array<{
    id: string;
    name: string;
    slug: string;
    _count: { questions: number };
  }>;
  questions: Array<{
    question: {
      id: string;
      slug: string;
      title: string;
      content: string;
      answer: string;
      analysis: string;
      difficulty: string;
      source?: string | null;
      tags?: Array<{ tag: { id: string; name: string; slug: string; type: string } }>;
      relationsFrom?: Array<{ to: { id: string } }>;
    };
  }>;
  _count: { questions: number };
};

export function TagDetailClient({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const fromTree = searchParams.get("from") === "tree";
  const backHref = fromTree ? "/tags?view=tree" : "/tags";

  const [tag, setTag] = useState<TagWithQuestions | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    const url = `/api/tags?slug=${encodeURIComponent(slug)}`;
    fetch(url)
      .then((res) => {
        if (res.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!cancelled && data) setTag(data);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        加载中…
      </div>
    );
  }

  if (notFound || !tag) {
    return (
      <div className="space-y-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          返回标签列表
        </Link>
        <div className="text-center py-16 text-muted-foreground">
          <Network className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>未找到该标签</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        返回标签列表
      </Link>

      <div className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          {tag.parent && (
            <>
              <Link href={`/tags/${tag.parent.slug}`}>
                <Badge variant="outline" className="text-xs cursor-pointer hover:bg-muted">
                  {tag.parent.name}
                </Badge>
              </Link>
              <span className="text-muted-foreground text-sm">›</span>
            </>
          )}
          <Badge
            className={`text-sm px-3 py-1 ${TAG_TYPE_COLORS[tag.type as keyof typeof TAG_TYPE_COLORS]}`}
          >
            {tag.name}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {TAG_TYPE_LABELS[tag.type as keyof typeof TAG_TYPE_LABELS]} · {(tag.questions?.length ?? tag._count?.questions ?? 0)} 道题
          </span>
        </div>

        {tag.description && (
          <p className="text-muted-foreground">{tag.description}</p>
        )}

        {tag.children?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">子标签：</span>
            {(tag.children || []).map((child) => (
              <Link key={child.id} href={`/tags/${child.slug}`}>
                <Badge
                  variant="outline"
                  className="text-xs cursor-pointer hover:bg-muted"
                >
                  {child.name}
                  <span className="ml-1 opacity-50">({child._count.questions})</span>
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </div>

      {!(tag.questions?.length) ? (
        <div className="text-center py-16 text-muted-foreground">
          <Network className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>该标签下暂无题目</p>
        </div>
      ) : (
        <div>
          <h2 className="font-semibold mb-4">该标签下全部题目（{tag.questions.length} 道）</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(tag.questions || []).map(({ question }) => (
              <QuestionCard key={question.id} question={question} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
