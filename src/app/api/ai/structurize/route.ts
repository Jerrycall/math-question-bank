import { NextRequest, NextResponse } from "next/server";
import { structurizeQuestion, getEmbedding } from "@/lib/ai/structurize";
import { db } from "@/lib/db";

/** Vercel：结构化 + 可选保存较慢，延长超时（需在套餐支持的前提下生效） */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const { text, save = false } = await request.json();

  if (!text) {
    return NextResponse.json({ error: "缺少题目文本" }, { status: 400 });
  }

  try {
    const structured = await structurizeQuestion(text);

    if (save) {
      // 生成 embedding
      const embeddingText = `${structured.title} ${text}`;
      const embedding = await getEmbedding(embeddingText);

      // 查找或创建标签
      const allTagNames = [
        ...structured.knowledge.map((n) => ({ name: n, type: "KNOWLEDGE" as const })),
        ...structured.method.map((n) => ({ name: n, type: "METHOD" as const })),
        ...structured.thought.map((n) => ({ name: n, type: "THOUGHT" as const })),
      ];

      const tagIds: string[] = [];
      for (const { name, type } of allTagNames) {
        const slug = name
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/[^\w\-\u4e00-\u9fa5]/g, "");
        const tag = await db.tag.upsert({
          where: { slug },
          create: { name, slug, type },
          update: {},
        });
        tagIds.push(tag.id);
      }

      const difficultyMap: Record<number, string> = {
        1: "EASY",
        2: "MEDIUM_LOW",
        3: "MEDIUM",
        4: "MEDIUM_HIGH",
        5: "HARD",
      };

      // 保存题目
      const question = await db.question.create({
        data: {
          slug: `q-${Date.now()}`,
          title: structured.title,
          content: text,
          answer: structured.answer,
          analysis: structured.analysis,
          difficulty:
            (difficultyMap[structured.difficulty] as "EASY" | "MEDIUM_LOW" | "MEDIUM" | "MEDIUM_HIGH" | "HARD") ??
            "MEDIUM",
          tags: {
            create: tagIds.map((tagId) => ({ tagId })),
          },
        },
      });

      // 存储向量（使用原始 SQL）
      await db.$executeRaw`
        UPDATE questions 
        SET embedding = ${JSON.stringify(embedding)}::vector
        WHERE id = ${question.id}
      `;

      return NextResponse.json({ structured, questionId: question.id });
    }

    return NextResponse.json({ structured });
  } catch (error) {
    console.error("AI structurize error:", error);
    const detail =
      error instanceof Error ? error.message.trim().slice(0, 400) : "";
    const hint =
      detail && detail.length > 0
        ? detail
        : "AI 处理失败，请检查 AI_API_KEY / OPENAI_API_KEY 与 Vercel 部署。";
    return NextResponse.json({ error: hint }, { status: 500 });
  }
}
