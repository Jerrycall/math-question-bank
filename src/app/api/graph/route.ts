import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { GraphNode, GraphEdge } from "@/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const questionId = searchParams.get("questionId");
  const tagSlug = searchParams.get("tag");
  const limit = parseInt(searchParams.get("limit") ?? "50");

  let questions;

  const tagFilter = { where: { tag: { type: { not: "SOURCE" } } }, include: { tag: true } };

  if (questionId) {
    const center = await db.question.findUnique({
      where: { id: questionId },
      include: {
        tags: tagFilter,
        relationsFrom: { include: { to: { include: { tags: tagFilter } } } },
        relationsTo: { include: { from: { include: { tags: tagFilter } } } },
      },
    });
    questions = center ? [center] : [];
  } else if (tagSlug) {
    questions = await db.question.findMany({
      where: { tags: { some: { tag: { slug: tagSlug } } } },
      include: {
        tags: tagFilter,
        relationsFrom: { include: { to: { include: { tags: tagFilter } } } },
      },
      take: limit,
    });
  } else {
    questions = await db.question.findMany({
      include: {
        tags: tagFilter,
        relationsFrom: { include: { to: true } },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    });
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const addedNodeIds = new Set<string>();
  const addedEdgeIds = new Set<string>();

  const addNode = (node: GraphNode) => {
    if (!addedNodeIds.has(node.id)) {
      nodes.push(node);
      addedNodeIds.add(node.id);
    }
  };

  const addEdge = (edge: GraphEdge) => {
    if (!addedEdgeIds.has(edge.id)) {
      edges.push(edge);
      addedEdgeIds.add(edge.id);
    }
  };

  for (const q of questions) {
    addNode({
      id: q.id,
      label: q.title,
      type: "question",
      data: q as unknown as GraphNode["data"],
    });

    for (const { tag } of q.tags) {
      if (tag.type === "SOURCE") continue;

      let nodeType: "knowledge" | "method" | "thought";
      if (tag.type === "KNOWLEDGE") nodeType = "knowledge";
      else if (tag.type === "METHOD") nodeType = "method";
      else if (tag.type === "THOUGHT") nodeType = "thought";
      else continue;

      addNode({
        id: `tag-${tag.id}`,
        label: tag.name,
        type: nodeType,
        data: tag as unknown as GraphNode["data"],
      });

      addEdge({
        id: `${q.id}-${tag.id}`,
        source: q.id,
        target: `tag-${tag.id}`,
        type: "tagged",
      });
    }

    if ("relationsFrom" in q) {
      for (const rel of (q as { relationsFrom?: Array<{ to: { id: string; title: string; slug: string }; relationType: string }> }).relationsFrom ?? []) {
        addNode({
          id: rel.to.id,
          label: rel.to.title,
          type: "question",
        });
        addEdge({
          id: `rel-${q.id}-${rel.to.id}`,
          source: q.id,
          target: rel.to.id,
          label:
            rel.relationType === "SIMILAR"
              ? "相似"
              : rel.relationType === "VARIANT"
              ? "变式"
              : "进阶",
          type: rel.relationType as GraphEdge["type"],
        });
      }
    }
  }

  return NextResponse.json({ nodes, edges });
}
