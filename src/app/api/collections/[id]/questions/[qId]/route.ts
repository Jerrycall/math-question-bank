import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

async function requireAccount(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; qId: string }> }
) {
  const accountId = await requireAccount(request);
  if (!accountId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const { id: collectionId, qId: questionId } = await params;

    const current = await db.collection.findUnique({
      where: { id: collectionId },
      select: { accountId: true },
    });
    if (!current || current.accountId !== accountId) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    await db.collectionQuestion.deleteMany({
      where: { collectionId, questionId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/collections/[id]/questions/[qId]] DELETE error:", e);
    return NextResponse.json({ error: "移除失败" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; qId: string }> }
) {
  const accountId = await requireAccount(request);
  if (!accountId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const { id: collectionId, qId: questionId } = await params;
    let body: { pageBreakBefore?: boolean; sortOrder?: number };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "请求体无效" }, { status: 400 });
    }

    const hasPageBreakBefore = typeof body.pageBreakBefore === "boolean";
    const hasSortOrder =
      typeof body.sortOrder === "number" &&
      Number.isInteger(body.sortOrder) &&
      body.sortOrder >= 0;
    if (!hasPageBreakBefore && !hasSortOrder) {
      return NextResponse.json(
        { error: "至少需要 pageBreakBefore 或 sortOrder" },
        { status: 400 }
      );
    }

    const current = await db.collection.findUnique({
      where: { id: collectionId },
      select: { accountId: true },
    });
    if (!current || current.accountId !== accountId) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const updated = await db.collectionQuestion.update({
      where: {
        collectionId_questionId: { collectionId, questionId },
      },
      data: {
        ...(hasPageBreakBefore ? { pageBreakBefore: body.pageBreakBefore } : {}),
        ...(hasSortOrder ? { sortOrder: body.sortOrder } : {}),
      },
    });

    return NextResponse.json({
      ok: true,
      pageBreakBefore: updated.pageBreakBefore,
      sortOrder: updated.sortOrder,
    });
  } catch (e) {
    console.error("[api/collections/[id]/questions/[qId]] PATCH error:", e);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

