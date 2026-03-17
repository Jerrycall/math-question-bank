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
  } catch {
    return new Response("AI 服务暂时不可用", { status: 500 });
  }
}
