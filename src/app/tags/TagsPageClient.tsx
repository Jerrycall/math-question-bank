"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Tag as TagIcon, LayoutGrid, TreePine } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TAG_TYPE_LABELS, TAG_TYPE_COLORS, TagType } from "@/types";
import { TagTreeEditor } from "@/components/TagBrowser";
import { cn } from "@/lib/utils";

type ViewMode = "cards" | "tree";

interface TagsPageClientProps {
  tags: Array<{
    id: string;
    name: string;
    slug: string;
    type: string;
    description?: string | null;
    parentId?: string | null;
    sortOrder: number;
    children?: unknown[];
    _count?: { questions: number };
  }>;
}

export function TagsPageClient({ tags }: TagsPageClientProps) {
  const searchParams = useSearchParams();
  const viewFromUrl = searchParams.get("view");
  const [view, setView] = useState<ViewMode>(
    viewFromUrl === "tree" ? "tree" : "cards"
  );

  useEffect(() => {
    if (viewFromUrl === "tree") setView("tree");
    else if (viewFromUrl === "cards" || !viewFromUrl) setView("cards");
  }, [viewFromUrl]);

  const setViewAndUrl = (v: ViewMode) => {
    setView(v);
    const url = v === "tree" ? "/tags?view=tree" : "/tags";
    window.history.replaceState(null, "", url);
  };

  const tagsByType = (["KNOWLEDGE", "METHOD", "THOUGHT", "SOURCE"] as TagType[]).reduce(
    (acc, type) => {
      acc[type] = tags.filter((t) => t.type === type);
      return acc;
    },
    {} as Record<TagType, typeof tags>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center">
            <TagIcon className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">标签系统</h1>
            <p className="text-sm text-muted-foreground">
              按知识点、方法、思想多维度组织题目
            </p>
          </div>
        </div>
        <div className="flex rounded-lg border border-border p-1 bg-muted/30">
          <Button
            variant={view === "cards" ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5"
            onClick={() => setViewAndUrl("cards")}
          >
            <LayoutGrid className="h-4 w-4" />
            卡片
          </Button>
          <Button
            variant={view === "tree" ? "secondary" : "ghost"}
            size="sm"
            className="gap-1.5"
            onClick={() => setViewAndUrl("tree")}
          >
            <TreePine className="h-4 w-4" />
            树形整理
          </Button>
        </div>
      </div>

      {view === "cards" && (
        <>
          {(["KNOWLEDGE", "METHOD", "THOUGHT", "SOURCE"] as TagType[]).map((type) => {
            const typeTags = tagsByType[type];
            if (!typeTags || typeTags.length === 0) return null;

            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-lg font-semibold">{TAG_TYPE_LABELS[type]}</h2>
                  <span className="text-sm text-muted-foreground">
                    ({typeTags.length} 个)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {typeTags.map((tag) => (
                    <Link key={tag.id} href={`/tags/${tag.slug}`}>
                      <Card className="h-full hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <span
                              className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border",
                                TAG_TYPE_COLORS[tag.type as TagType]
                              )}
                            >
                              {tag.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {tag._count?.questions ?? 0} 题
                            </span>
                          </div>

                          {tag.children && Array.isArray(tag.children) && tag.children.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {(tag.children as { name: string }[]).slice(0, 4).map((child, i) => (
                                <span
                                  key={i}
                                  className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded"
                                >
                                  {child.name}
                                </span>
                              ))}
                              {tag.children.length > 4 && (
                                <span className="text-xs text-muted-foreground">
                                  +{tag.children.length - 4}
                                </span>
                              )}
                            </div>
                          )}

                          {tag.description && (
                            <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                              {tag.description}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}

          {tags.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              <TagIcon className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>暂无标签</p>
              <p className="text-sm mt-1">录入题目后，AI 会自动提取知识点标签</p>
            </div>
          )}
        </>
      )}

      {view === "tree" && <TagTreeEditor />}
    </div>
  );
}
