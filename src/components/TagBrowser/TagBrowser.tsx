"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown, Tag as TagIcon, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tag, TagType, TAG_TYPE_LABELS, TAG_TYPE_COLORS } from "@/types";

interface TagTreeNodeProps {
  tag: Tag;
  level?: number;
  selectedIds: string[];
  onToggle: (tag: Tag) => void;
}

function TagTreeNode({
  tag,
  level = 0,
  selectedIds,
  onToggle,
}: TagTreeNodeProps) {
  const [expanded, setExpanded] = useState(level === 0);
  const hasChildren = tag.children && tag.children.length > 0;
  const isSelected = selectedIds.includes(tag.id);
  const count = tag._count?.questions ?? 0;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer group transition-colors",
          isSelected
            ? "bg-primary/10 text-primary"
            : "hover:bg-muted/50 text-foreground"
        )}
        style={{ paddingLeft: `${8 + level * 16}px` }}
        title={isSelected ? "再次点击取消选择" : "点击选中"}
        onClick={() => onToggle(tag)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle(tag);
          }
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="p-0.5 hover:bg-muted rounded shrink-0"
            aria-label={expanded ? "收起" : "展开"}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        <TagIcon className="h-3 w-3 shrink-0 opacity-60" />
        <span className="text-sm flex-1 truncate">{tag.name}</span>
        {count > 0 && (
          <span className="text-xs text-muted-foreground ml-auto shrink-0">
            {count}
          </span>
        )}
      </div>

      {hasChildren && expanded && (
        <div>
          {tag.children!.map((child) => (
            <TagTreeNode
              key={child.id}
              tag={child}
              level={level + 1}
              selectedIds={selectedIds}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TagBrowserProps {
  tags: Tag[];
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  showTypes?: TagType[];
}

export function TagBrowser({
  tags,
  selectedIds = [],
  onSelectionChange,
  showTypes = ["KNOWLEDGE", "METHOD", "THOUGHT", "SOURCE"],
}: TagBrowserProps) {
  const [internalSelected, setInternalSelected] = useState<string[]>(selectedIds);
  const selected = onSelectionChange ? selectedIds : internalSelected;
  const setSelected = onSelectionChange ?? setInternalSelected;

  const handleToggle = (tag: Tag) => {
    const next = selected.includes(tag.id)
      ? selected.filter((id) => id !== tag.id)
      : [...selected, tag.id];
    setSelected(next);
  };

  const clearAll = () => setSelected([]);

  // 按类型分组，只取顶层标签（无 parentId）
  const tagsByType = showTypes.reduce(
    (acc, type) => {
      acc[type] = tags.filter((t) => t.type === type && !t.parentId);
      return acc;
    },
    {} as Record<TagType, Tag[]>
  );

  const selectedTags = tags.filter((t) => selected.includes(t.id));

  return (
    <div className="space-y-4">
      {/* 已选标签 */}
      {selectedTags.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              已选筛选条件
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-6 text-xs text-muted-foreground hover:text-foreground"
            >
              清除全部
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedTags.map((tag) => (
              <Badge
                key={tag.id}
                className={cn(
                  "text-xs cursor-pointer",
                  TAG_TYPE_COLORS[tag.type]
                )}
                onClick={() => handleToggle(tag)}
              >
                {tag.name}
                <X className="h-2.5 w-2.5 ml-1" />
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* 标签树 */}
      {showTypes.map((type) => {
        const typeTags = tagsByType[type];
        if (!typeTags || typeTags.length === 0) return null;

        return (
          <div key={type}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-2">
              {TAG_TYPE_LABELS[type]}
            </p>
            <div className="space-y-0.5">
              {typeTags.map((tag) => (
                <TagTreeNode
                  key={tag.id}
                  tag={tag}
                  selectedIds={selected}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// 标签云组件（用于展示页）
interface TagCloudProps {
  tags: Tag[];
  maxCount?: number;
}

export function TagCloud({ tags, maxCount }: TagCloudProps) {
  const sorted = [...tags].sort(
    (a, b) => (b._count?.questions ?? 0) - (a._count?.questions ?? 0)
  );
  const shown = maxCount ? sorted.slice(0, maxCount) : sorted;
  const maxQ = shown[0]?._count?.questions ?? 1;

  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((tag) => {
        const count = tag._count?.questions ?? 0;
        const ratio = count / maxQ;
        const size =
          ratio > 0.8
            ? "text-base"
            : ratio > 0.5
            ? "text-sm"
            : "text-xs";

        return (
          <Link key={tag.id} href={`/tags/${tag.slug}`}>
            <Badge
              className={cn(
                "cursor-pointer hover:opacity-80 transition-opacity",
                TAG_TYPE_COLORS[tag.type],
                size
              )}
            >
              {tag.name}
              {count > 0 && (
                <span className="ml-1 opacity-60">({count})</span>
              )}
            </Badge>
          </Link>
        );
      })}
    </div>
  );
}
