import { NextRequest, NextResponse } from "next/server";
import { getEmbedding } from "@/lib/ai/structurize";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { questionId, text, limit = 5 } = await request.json();

  try {
    let queryText = text;

    if (!queryText && questionId) {
      const q = await db.question.findUnique({
        where: { id: questionId },
        select: { title: true, content: true },
      });
      if (!q) return NextResponse.json({ error: "题目不存在" }, { status: 404 });
      queryText = `${q.title} ${q.content}`;
    }

    if (!queryText) {
      return NextResponse.json({ error: "缺少查询文本" }, { status: 400 });
    }

    const embedding = await getEmbedding(queryText);
    const embeddingStr = JSON.stringify(embedding);

    // 使用 pgvector 余弦相似度搜索
    const similar = await db.$queryRaw<
      Array<{ id: string; slug: string; title: string; similarity: number }>
    >`
      SELECT id, slug, title,
             1 - (embedding <=> ${embeddingStr}::vector) AS similarity
      FROM questions
      WHERE id != ${questionId ?? ""}
        AND embedding IS NOT NULL
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `;

    // 获取完整题目信息
    const questionIds = similar.map((r) => r.id);
    const questions = await db.question.findMany({
      where: { id: { in: questionIds } },
      include: {
        tags: { include: { tag: true } },
      },
    });

    // 按相似度排序
    const ordered = similar.map((s) => ({
      ...questions.find((q) => q.id === s.id),
      similarity: s.similarity,
    }));

    return NextResponse.json({ similar: ordered });
  } catch (error) {
    console.error("Similar search error:", error);
    return NextResponse.json({ error: "搜索失败" }, { status: 500 });
  }
}
