import { NextRequest, NextResponse } from "next/server";
import { generateVariants } from "@/lib/ai/structurize";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { questionId } = await request.json();

  if (!questionId) {
    return NextResponse.json({ error: "缺少 questionId" }, { status: 400 });
  }

  const question = await db.question.findUnique({
    where: { id: questionId },
    select: { content: true, analysis: true },
  });

  if (!question) {
    return NextResponse.json({ error: "题目不存在" }, { status: 404 });
  }

  try {
    const variants = await generateVariants(question.content, question.analysis);
    return NextResponse.json(variants);
  } catch {
    return NextResponse.json({ error: "生成失败" }, { status: 500 });
  }
}
