import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

async function requireAccount(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const accountId = await requireAccount(request);
  if (!accountId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const collection = await db.collection.findUnique({
      where: { id },
      include: {
        _count: { select: { questions: true } },
        questions: {
          orderBy: { sortOrder: "asc" },
          include: {
            question: {
              select: {
                id: true,
                slug: true,
                title: true,
                content: true,
                answer: true,
                analysis: true,
                difficulty: true,
                source: true,
                // 用于 QuestionCard compact 渲染
                mdFilePath: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    if (!collection || collection.accountId !== accountId) {
      return NextResponse.json({ error: "不存在" }, { status: 404 });
    }

    return NextResponse.json({
      collection: {
        id: collection.id,
        name: collection.name,
        accountId: collection.accountId,
        createdAt: collection.createdAt,
        questionsCount: collection._count.questions,
        questions: collection.questions.map((cq) => ({
          ...cq.question,
          pageBreakBefore: cq.pageBreakBefore,
        })),
      },
    });
  } catch (e) {
    console.error("[api/collections/[id]] GET error:", e);
    const msg = e instanceof Error ? e.message : String(e);
    const likelySchema =
      /pageBreakBefore|column|does not exist|42703/i.test(msg);
    return NextResponse.json(
      {
        error: likelySchema
          ? "数据库尚未同步最新结构（缺少 pageBreakBefore 等字段）。请在 Neon 执行 npx prisma db push，或重新部署（构建已包含 db push）。"
          : "加载题集失败，请稍后重试",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const accountId = await requireAccount(request);
  if (!accountId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const name = String(body?.name ?? "").trim();
    if (!name || name.length > 50) {
      return NextResponse.json({ error: "题集名称不合法" }, { status: 400 });
    }

    const current = await db.collection.findUnique({
      where: { id },
      select: { accountId: true },
    });
    if (!current || current.accountId !== accountId) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    const collection = await db.collection.update({
      where: { id },
      data: { name },
    });

    return NextResponse.json({ collection });
  } catch (e) {
    console.error("[api/collections/[id]] PATCH error:", e);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const accountId = await requireAccount(request);
  if (!accountId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const current = await db.collection.findUnique({
      where: { id },
      select: { accountId: true },
    });
    if (!current || current.accountId !== accountId) {
      return NextResponse.json({ error: "无权限" }, { status: 403 });
    }

    await db.collection.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/collections/[id]] DELETE error:", e);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}

