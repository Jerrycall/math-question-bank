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

    const body = await request.json();
    const questionIds: string[] = Array.isArray(body?.questionIds)
      ? body.questionIds.map(String)
      : [];

    const uniqueIds = Array.from(new Set(questionIds)).filter(Boolean);
    if (uniqueIds.length === 0) {
      return NextResponse.json({ error: "未提供题目" }, { status: 400 });
    }

    await db.collectionQuestion.createMany({
      data: uniqueIds.map((questionId, idx) => ({
        collectionId,
        questionId,
        sortOrder: idx,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/collections/[id]/questions] POST error:", e);
    return NextResponse.json({ error: "添加失败" }, { status: 500 });
  }
}

