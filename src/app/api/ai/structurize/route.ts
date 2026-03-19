import { NextRequest, NextResponse } from "next/server";
import { structurizeQuestion, getEmbedding } from "@/lib/ai/structurize";
import { db } from "@/lib/db";

/** Vercel：结构化 + 可选保存较慢，延长超时（需在套餐支持的前提下生效） */
export const maxDuration = 60;

function errorToClientMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim().slice(0, 500);
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const m = (error as { message: unknown }).message;
    if (typeof m === "string" && m.trim()) return m.trim().slice(0, 500);
  }
  const s = String(error);
  if (s && s !== "[object Object]") return s.slice(0, 500);
  return "AI 处理失败，请检查 AI_API_KEY / AI_API_BASE_URL 与 Vercel 部署。";
}

export async function POST(request: NextRequest) {
  let body: { text?: string; save?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { text, save = false } = body;

  if (!text) {
    return NextResponse.json({ error: "缺少题目文本" }, { status: 400 });
  }

  /**
   * 用流式响应：在 AI 完成前就返回 HTTP 头并尽快写出首字节，避免部分 CDN/网关
   * 「首字节超时」在整段 JSON 缓冲好之前断开连接（浏览器表现为 Failed to fetch）。
   * JSON 允许前导空白，先写 \\n 再写完整对象，合并后仍能被 JSON.parse。
   */
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode("\n"));
      try {
        const structured = await structurizeQuestion(text);

        if (save) {
          const embeddingText = `${structured.title} ${text}`;
          const embedding = await getEmbedding(embeddingText);

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

          const question = await db.question.create({
            data: {
              slug: `q-${Date.now()}`,
              title: structured.title,
              content: text,
              answer: structured.answer,
              analysis: structured.analysis,
              difficulty:
                (difficultyMap[structured.difficulty] as
                  | "EASY"
                  | "MEDIUM_LOW"
                  | "MEDIUM"
                  | "MEDIUM_HIGH"
                  | "HARD") ?? "MEDIUM",
              tags: {
                create: tagIds.map((tagId) => ({ tagId })),
              },
            },
          });

          await db.$executeRaw`
            UPDATE questions 
            SET embedding = ${JSON.stringify(embedding)}::vector
            WHERE id = ${question.id}
          `;

          controller.enqueue(
            encoder.encode(JSON.stringify({ structured, questionId: question.id }))
          );
        } else {
          controller.enqueue(encoder.encode(JSON.stringify({ structured })));
        }
      } catch (error) {
        console.error("AI structurize error:", error);
        controller.enqueue(
          encoder.encode(JSON.stringify({ error: errorToClientMessage(error) }))
        );
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
