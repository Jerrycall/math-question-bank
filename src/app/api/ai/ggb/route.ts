import { NextRequest, NextResponse } from "next/server";
import { generateGgbCommands } from "@/lib/ai/structurize";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { text?: string; intent?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const text = body.text?.trim();
  const intent = body.intent?.trim();

  if (!text) {
    return NextResponse.json({ error: "缺少题目文本" }, { status: 400 });
  }

  try {
    const result = await generateGgbCommands(text, intent);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim().slice(0, 500)
        : "GGB 命令生成失败，请检查 AI 配置后重试。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
