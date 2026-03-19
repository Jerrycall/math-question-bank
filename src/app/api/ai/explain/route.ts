import { NextRequest } from "next/server";
import { explainQuestion } from "@/lib/ai/structurize";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { questionId, userQuery } = await request.json();

  if (!questionId || !userQuery) {
    return new Response("缺少参数", { status: 400 });
  }

  const question = await db.question.findUnique({
    where: { id: questionId },
    select: { content: true, analysis: true },
  });

  if (!question) {
    return new Response("题目不存在", { status: 404 });
  }

  try {
    const stream = await explainQuestion(
      question.content,
      question.analysis,
      userQuery
    );

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (e) {
    console.error("[api/ai/explain]", e);
    const detail =
      e instanceof Error ? e.message.trim().slice(0, 500) : "未知错误";
    const hint =
      detail && detail.length > 0
        ? detail
        : "AI 服务暂时不可用。请确认 Vercel 已配置 AI_API_KEY + AI_API_BASE_URL（DeepSeek）或 OPENAI_API_KEY，并已 Redeploy。";
    return new Response(hint, {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}
