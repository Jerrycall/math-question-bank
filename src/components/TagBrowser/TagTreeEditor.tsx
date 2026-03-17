"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown, Tag as TagIcon, GripVertical, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tag, TagType, TAG_TYPE_LABELS, TAG_TYPE_COLORS } from "@/types";

function collectDescendantIds(tag: Tag): Set<string> {
  const ids = new Set<string>();
  function walk(t: Tag) {
    if (t.children) {
      for (const c of t.children) {
        ids.add(c.id);
        walk(c);
      }
    }
  }
  walk(tag);
  return ids;
}

interface DraggableNodeProps {
  tag: Tag;
  level: number;
  draggedId: string | null;
  descendantIdsOfDragged: Set<string>;
  onDragStart: (id: string, descendants: Set<string>) => void;
  onDragEnd: () => void;
  onDrop: (targetTagId: string | null, movedTagId: string) => void;
}

function DraggableNode({
  tag,
  level,
  draggedId,
  descendantIdsOfDragged,
  onDragStart,
  onDragEnd,
  onDrop,
}: DraggableNodeProps) {
  const [expanded, setExpanded] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const hasChildren = tag.children && tag.children.length > 0;
  const count = tag._count?.questions ?? 0;
  const isDragging = draggedId === tag.id;
  const canDrop =
    draggedId &&
    draggedId !== tag.id &&
    !descendantIdsOfDragged.has(tag.id);

  const handleHandleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", tag.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.dropEffect = "move";
    e.stopPropagation();
    onDragStart(tag.id, collectDescendantIds(tag));
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = canDrop ? "move" : "none";
    if (canDrop) setDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = canDrop ? "move" : "none";
    setDragOver(canDrop ?? false);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const movedId = e.dataTransfer.getData("text/plain");
    const targetTagId = (e.currentTarget as HTMLElement).getAttribute("data-tag-id");
    if (!movedId || !targetTagId || movedId === targetTagId || descendantIdsOfDragged.has(targetTagId)) return;
    onDrop(targetTagId, movedId);
  };

  return (
    <div>
      <div
        data-tag-id={tag.id}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "flex items-center gap-1.5 py-1.5 px-2 rounded-lg border border-transparent transition-colors",
          isDragging && "opacity-50",
          canDrop && dragOver && "bg-primary/15 border-primary/40"
        )}
        style={{ paddingLeft: `${8 + level * 16}px` }}
      >
        <span
          draggable
          onDragStart={handleHandleDragStart}
          onDragEnd={onDragEnd}
          className="cursor-grab active:cursor-grabbing touch-none flex shrink-0 rounded p-0.5 hover:bg-muted/80 text-muted-foreground hover:text-foreground"
          title="拖动以调整层级"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
        {hasChildren ? (
          <button
            type="button"
            className={cn("p-0.5 hover:bg-muted rounded", draggedId && "pointer-events-none")}
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
        <Link
          href={`/tags/${tag.slug}?from=tree`}
          className={cn("text-sm flex-1 truncate hover:underline", draggedId && "pointer-events-none")}
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        >
          {tag.name}
        </Link>
        {count > 0 && (
          <span className="text-xs text-muted-foreground ml-auto shrink-0">
            {count}
          </span>
        )}
      </div>

      {hasChildren && expanded && (
        <div>
          {tag.children!.map((child) => (
            <DraggableNode
              key={child.id}
              tag={child}
              level={level + 1}
              draggedId={draggedId}
              descendantIdsOfDragged={descendantIdsOfDragged}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TagTreeEditorProps {
  showTypes?: TagType[];
}

export function TagTreeEditor({
  showTypes = ["KNOWLEDGE", "METHOD", "THOUGHT", "SOURCE"],
}: TagTreeEditorProps) {
  const [roots, setRoots] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [descendantIdsOfDragged, setDescendantIdsOfDragged] = useState<Set<string>>(new Set());
  const [updating, setUpdating] = useState(false);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tags?tree=true&withCount=true");
      const list = await res.json();
      if (Array.isArray(list)) setRoots(list);
      else setRoots([]);
    } catch {
      setRoots([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const handleDragStart = (id: string, descendants: Set<string>) => {
    setDraggedId(id);
    setDescendantIdsOfDragged(descendants);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDescendantIdsOfDragged(new Set());
  };

  const clearDragState = () => {
    setDraggedId(null);
    setDescendantIdsOfDragged(new Set());
  };

  const handleDropOnTag = async (targetTagId: string | null, movedTagId: string) => {
    if (movedTagId === targetTagId) return;
    clearDragState();
    setUpdating(true);
    try {
      const res = await fetch(`/api/tags/${movedTagId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: targetTagId || null }),
      });
      if (res.ok) await fetchTags();
    } finally {
      setUpdating(false);
    }
  };

  const handleDropOnRoot = (e: React.DragEvent, type: TagType) => {
    e.preventDefault();
    e.stopPropagation();
    const movedId = e.dataTransfer.getData("text/plain");
    if (!movedId) return;
    const movedTag = findTagById(roots, movedId);
    if (movedTag && movedTag.type === type) {
      void handleDropOnTag(null, movedId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        加载标签树…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {updating && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在更新…
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        拖动标签可调整层级，拖到某标签上即成为其子节点，拖到类型标题下的空白处则变为该类型的一级标签。
      </p>
      {showTypes.map((type) => {
        const typeRoots = roots.filter((t) => t.type === type);
        if (!typeRoots.length) return null;

        return (
          <div key={type}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-2">
              {TAG_TYPE_LABELS[type]}
            </p>
            <div
              className="space-y-0.5 rounded-lg border border-dashed border-transparent hover:border-muted-foreground/20 min-h-[40px] p-1"
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => handleDropOnRoot(e, type)}
            >
              {typeRoots.map((tag) => (
                <DraggableNode
                  key={tag.id}
                  tag={tag}
                  level={0}
                  draggedId={draggedId}
                  descendantIdsOfDragged={descendantIdsOfDragged}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDrop={handleDropOnTag}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function findTagById(tags: Tag[], id: string): Tag | null {
  for (const t of tags) {
    if (t.id === id) return t;
    if (t.children) {
      const found = findTagById(t.children, id);
      if (found) return found;
    }
  }
  return null;
}
