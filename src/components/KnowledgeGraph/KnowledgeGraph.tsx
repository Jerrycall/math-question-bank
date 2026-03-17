"use client";

import React, { useEffect, useRef, useState } from "react";
import { GraphNode, GraphEdge } from "@/types";

interface KnowledgeGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeClick?: (node: GraphNode) => void;
  height?: number;
}

const NODE_COLORS: Record<GraphNode["type"], string> = {
  question: "#6366f1",   // 紫色 - 题目
  knowledge: "#10b981",  // 绿色 - 知识点
  method: "#f59e0b",     // 黄色 - 方法
  thought: "#ef4444",    // 红色 - 思想
  source: "#64748b",    // 灰色 - 来源
};

const NODE_SHAPES: Record<GraphNode["type"], string> = {
  question: "ellipse",
  knowledge: "diamond",
  method: "hexagon",
  thought: "triangle",
  source: "round-rectangle",
};

const NODE_TYPE_LABELS: Record<string, string> = {
  question: "题目",
  knowledge: "知识点",
  method: "方法",
  thought: "思想",
  source: "思想",
};

export function KnowledgeGraph({
  nodes,
  edges,
  onNodeClick,
  height = 600,
}: KnowledgeGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<unknown>(null);
  const layoutRef = useRef<{ stop: () => void } | null>(null);
  const mountedRef = useRef(true);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    mountedRef.current = true;
    if (!containerRef.current || nodes.length === 0) return;

    import("cytoscape").then((cytoscapeModule) => {
      if (!mountedRef.current || !containerRef.current) return;

      const cytoscape = cytoscapeModule.default;

      if (cyRef.current) {
        try {
          (cyRef.current as { destroy: () => void }).destroy();
        } catch {
          // 忽略销毁时的内部错误
        }
        cyRef.current = null;
      }

      const elements = [
        ...nodes.map((n) => ({
          data: {
            id: n.id,
            label: n.label.length > 12 ? n.label.slice(0, 12) + "…" : n.label,
            fullLabel: n.label,
            type: n.type,
            nodeData: n,
          },
        })),
        ...edges.map((e) => ({
          data: {
            id: e.id,
            source: e.source,
            target: e.target,
            label: e.label ?? "",
          },
        })),
      ];

      const cy = cytoscape({
        container: containerRef.current,
        elements,
        style: [
          {
            selector: "node",
            style: {
              "background-color": (ele: { data: (k: string) => string }) => {
                const t = ele.data("type") as string;
                const colorType = t === "source" ? "thought" : (t as GraphNode["type"]);
                return NODE_COLORS[colorType] ?? "#888";
              },
              shape: (ele: { data: (k: string) => string }) => {
                const t = ele.data("type") as string;
                const shapeType = t === "source" ? "thought" : (t as GraphNode["type"]);
                return NODE_SHAPES[shapeType] ?? "ellipse";
              },
              label: "data(label)",
              color: "#fff",
              "text-outline-color": "#0005",
              "text-outline-width": 1,
              "font-size": 11,
              "text-valign": "center",
              "text-halign": "center",
              width: (ele: { data: (k: string) => string }) =>
                (ele.data("type") === "question" ? 60 : 50),
              height: (ele: { data: (k: string) => string }) =>
                (ele.data("type") === "question" ? 60 : 50),
              "border-width": 2,
              "border-color": "#ffffff40",
              "transition-property": "background-color, border-color, width, height",
              "transition-duration": 200,
            } as Record<string, unknown>,
          },
          {
            selector: "node:selected",
            style: {
              "border-width": 3,
              "border-color": "#fff",
              width: 70,
              height: 70,
            } as Record<string, unknown>,
          },
          {
            selector: "node:hover",
            style: {
              opacity: 0.8,
              cursor: "pointer",
            } as Record<string, unknown>,
          },
          {
            selector: "edge",
            style: {
              width: 1.5,
              "line-color": "#94a3b880",
              "target-arrow-color": "#94a3b880",
              "target-arrow-shape": "triangle",
              "curve-style": "bezier",
              label: "data(label)",
              "font-size": 9,
              color: "#64748b",
              "text-background-color": "#fff",
              "text-background-opacity": 0.8,
              "text-background-padding": 2,
            } as Record<string, unknown>,
          },
          {
            selector: "edge:selected",
            style: {
              "line-color": "#6366f1",
              "target-arrow-color": "#6366f1",
              width: 2.5,
            } as Record<string, unknown>,
          },
        ],
        userZoomingEnabled: true,
        userPanningEnabled: true,
        minZoom: 0.3,
        maxZoom: 3,
      });

      cyRef.current = cy;
      layoutRef.current = null;

      const layout = (cy as { layout: (opts: unknown) => { run: () => void; stop: () => void } }).layout({
        name: "cose",
        animate: false,
        nodeRepulsion: 8000,
        idealEdgeLength: 120,
        edgeElasticity: 0.45,
        gravity: 0.3,
        numIter: 250,
        randomize: false,
      });
      layoutRef.current = layout;
      layout.run();

      type CyEventHandler = (e: { target: { data: (k: string) => unknown; is: (s: string) => boolean } }) => void;
      const cyInstance = cy as { on: (event: string, selector: string | CyEventHandler, cb?: CyEventHandler) => void };

      cyInstance.on("tap", "node", (e) => {
        if (!mountedRef.current) return;
        const nodeData = e.target.data("nodeData") as GraphNode;
        setSelectedNode(nodeData);
        onNodeClick?.(nodeData);
      });

      cyInstance.on("tap", (e) => {
        if (!mountedRef.current) return;
        const target = e.target;
        const isNode = typeof target?.is === "function" && target.is("node");
        if (!isNode) setSelectedNode(null);
      });

      if (mountedRef.current) setIsLoaded(true);
    });

    return () => {
      mountedRef.current = false;
      try {
        if (layoutRef.current && typeof layoutRef.current.stop === "function") {
          layoutRef.current.stop();
        }
      } catch {
        // 忽略
      }
      layoutRef.current = null;
      if (cyRef.current) {
        try {
          (cyRef.current as { destroy: () => void }).destroy();
        } catch {
          // 卸载时可能触发的内部回调忽略
        }
        cyRef.current = null;
      }
    };
  }, [nodes, edges, onNodeClick]);

  return (
    <div className="relative rounded-xl border border-border overflow-hidden bg-slate-950">
      {/* 图谱容器 */}
      <div ref={containerRef} style={{ height, width: "100%" }} />

      {/* 图例 */}
      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-lg p-3 space-y-1.5">
        {(
          [
            { type: "question", label: "题目" },
            { type: "knowledge", label: "知识点" },
            { type: "method", label: "方法" },
            { type: "thought", label: "思想" },
          ] as { type: GraphNode["type"]; label: string }[]
        ).map(({ type, label }) => (
          <div key={type} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: NODE_COLORS[type] }}
            />
            <span className="text-xs text-white/80">{label}</span>
          </div>
        ))}
      </div>

      {/* 统计信息 */}
      <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-2">
        <p className="text-xs text-white/80">
          {nodes.length} 节点 · {edges.length} 关系
        </p>
      </div>

      {/* 加载提示 */}
      {!isLoaded && nodes.length > 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80">
          <div className="text-white/60 text-sm animate-pulse">
            正在渲染知识图谱...
          </div>
        </div>
      )}

      {/* 节点详情弹出 */}
      {selectedNode && (
        <div className="absolute bottom-3 left-3 right-3 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{
                  backgroundColor:
                    NODE_COLORS[
                      selectedNode.type === "source" ? "thought" : selectedNode.type
                    ] ?? NODE_COLORS.thought,
                }}
                />
                <span className="text-xs text-white/60 uppercase">
                  {NODE_TYPE_LABELS[selectedNode.type] ?? "思想"}
                </span>
              </div>
              <p className="font-medium">{selectedNode.label}</p>
            </div>
            <button
              className="text-white/40 hover:text-white text-lg leading-none"
              onClick={() => setSelectedNode(null)}
            >
              ×
            </button>
          </div>
          {selectedNode.type === "question" && (
            <a
              href={`/questions/${(selectedNode.data as { slug?: string })?.slug ?? selectedNode.id}`}
              className="mt-2 inline-block text-xs text-indigo-400 hover:text-indigo-300 underline"
            >
              查看题目详情 →
            </a>
          )}
          {selectedNode.type !== "question" && (
            <a
              href={`/tags/${(selectedNode.data as { slug?: string })?.slug ?? selectedNode.id}`}
              className="mt-2 inline-block text-xs text-emerald-400 hover:text-emerald-300 underline"
            >
              查看相关题目 →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
