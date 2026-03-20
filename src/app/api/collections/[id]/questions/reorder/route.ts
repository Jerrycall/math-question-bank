import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

async function requireAccount(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const accountId = await requireAccount(request);
  if (!accountId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const { id: collectionId } = await params;
    const current = await db.collection.findUnique({
      where: { id: collectionId },
      select: { accountId: true },
    });
    if (!current || current.accountId !== accountId) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const questionIds = Array.isArray(body?.questionIds)
      ? body.questionIds.map(String).filter(Boolean)
      : [];
    if (questionIds.length === 0) {
      return NextResponse.json({ error: "未提供题目顺序" }, { status: 400 });
    }

    const existing = await db.collectionQuestion.findMany({
      where: { collectionId },
      select: { questionId: true },
    });
    const existingIds = new Set(existing.map((row) => row.questionId));
    if (questionIds.length !== existing.length) {
      return NextResponse.json({ error: "题目数量不匹配" }, { status: 400 });
    }
    for (const id of questionIds) {
      if (!existingIds.has(id)) {
        return NextResponse.json({ error: "顺序中包含无效题目" }, { status: 400 });
      }
    }

    await db.$transaction(
      questionIds.map((questionId: string, idx: number) =>
        db.collectionQuestion.update({
          where: { collectionId_questionId: { collectionId, questionId } },
          data: { sortOrder: idx },
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/collections/[id]/questions/reorder] POST error:", e);
    return NextResponse.json({ error: "重排失败" }, { status: 500 });
  }
}

