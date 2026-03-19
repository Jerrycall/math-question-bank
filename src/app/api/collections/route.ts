import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

async function requireAccount(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function GET(request: NextRequest) {
  const accountId = await requireAccount(request);
  if (!accountId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const collections = await db.collection.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { questions: true } },
    },
  });

  return NextResponse.json({ collections });
}

export async function POST(request: NextRequest) {
  const accountId = await requireAccount(request);
  if (!accountId) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = String(body?.name ?? "").trim();
    if (!name || name.length > 50) {
      return NextResponse.json({ error: "题集名称不合法" }, { status: 400 });
    }

    const collection = await db.collection.create({
      data: { name, accountId },
    });
    return NextResponse.json({ collection }, { status: 201 });
  } catch (e) {
    console.error("[api/collections] POST error:", e);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}

