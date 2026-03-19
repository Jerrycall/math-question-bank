import { NextRequest, NextResponse } from "next/server";
import { generateGgbCommands, repairGgbCommands } from "@/lib/ai/structurize";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: {
    mode?: "generate" | "repair";
    text?: string;
    intent?: string;
    answer?: string;
    analysis?: string;
    tags?: string[];
    commands?: string[];
    failedLine?: string;
    errorHint?: string;
  };
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
  if (body.mode === "repair") {
    if (!Array.isArray(body.commands) || body.commands.length === 0) {
      return NextResponse.json({ error: "repair 模式缺少 commands" }, { status: 400 });
    }
    if (!body.failedLine?.trim()) {
      return NextResponse.json({ error: "repair 模式缺少 failedLine" }, { status: 400 });
    }
  }

  try {
    const context = {
      answer: body.answer,
      analysis: body.analysis,
      tags: Array.isArray(body.tags) ? body.tags : [],
    };
    const result =
      body.mode === "repair"
        ? await repairGgbCommands(
            text,
            Array.isArray(body.commands) ? body.commands : [],
            body.failedLine?.trim() || "",
            body.errorHint?.trim(),
            intent,
            context
          )
        : await generateGgbCommands(text, intent, context);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim().slice(0, 500)
        : "GGB 命令生成失败，请检查 AI 配置后重试。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
