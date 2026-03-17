"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Network, Search } from "lucide-react";
import { KnowledgeGraph } from "@/components/KnowledgeGraph";
import { GraphErrorBoundary } from "@/components/KnowledgeGraph/GraphErrorBoundary";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GraphNode, GraphEdge } from "@/types";

export default function GraphPage() {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [graphKey, setGraphKey] = useState(0);
  const [graphError, setGraphError] = useState(false);

  useEffect(() => {
    const handler = (e: ErrorEvent) => {
      if (e.message?.includes("notify") && e.filename?.includes("cytoscape")) {
        setGraphError(true);
        e.preventDefault();
        return true;
      }
    };
    window.addEventListener("error", handler);
    return () => window.removeEventListener("error", handler);
  }, []);

  const fetchGraph = useCallback(async (tag?: string) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "30" });
    if (tag) params.set("tag", tag);
    const res = await fetch(`/api/graph?${params}`);
    const data = await res.json();
    setNodes(data.nodes ?? []);
    setEdges(data.edges ?? []);
    setGraphError(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGraph();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      fetchGraph(search.trim());
    } else {
      fetchGraph();
    }
  };

  return (
    <div className="space-y-4">
      {/* 头部 */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
          <Network className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">知识图谱</h1>
          <p className="text-sm text-muted-foreground">
            可视化题目与知识点的关联网络
          </p>
        </div>
      </div>

      {/* 搜索 */}
      <form onSubmit={handleSearch} className="flex gap-2 max-w-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="按知识点标签过滤..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button type="submit" variant="outline">
          过滤
        </Button>
        {search && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearch("");
              fetchGraph();
            }}
          >
            重置
          </Button>
        )}
      </form>

      {/* 图谱提示 */}
      <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
        提示：可鼠标滚轮缩放、拖拽平移；点击节点查看详情；题目节点（圆形紫色）可直接跳转。
      </div>

      {/* 图谱主体 */}
      {loading ? (
        <div className="h-[600px] rounded-xl bg-slate-950 flex items-center justify-center">
          <div className="text-white/40 animate-pulse">加载知识图谱中...</div>
        </div>
      ) : nodes.length === 0 ? (
        <div className="h-[400px] rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Network className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>暂无数据</p>
            <p className="text-sm mt-1">录入题目后，知识图谱将自动构建</p>
          </div>
        </div>
      ) : graphError ? (
        <div className="h-[600px] rounded-xl border border-border bg-muted/40 flex items-center justify-center p-8">
          <div className="text-center max-w-sm space-y-4">
            <p className="text-muted-foreground text-sm">
              图谱渲染时出错，可能是数据量较大或页面切换过快导致。
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setGraphError(false);
                setGraphKey((k) => k + 1);
                fetchGraph(search.trim() || undefined);
              }}
            >
              重试
            </Button>
          </div>
        </div>
      ) : (
        <GraphErrorBoundary
          onRetry={() => {
            setGraphKey((k) => k + 1);
            fetchGraph(search.trim() || undefined);
          }}
        >
          <KnowledgeGraph
            key={graphKey}
            nodes={nodes}
            edges={edges}
            height={620}
            onNodeClick={(node) => {
              console.log("Clicked:", node);
            }}
          />
        </GraphErrorBoundary>
      )}
    </div>
  );
}
