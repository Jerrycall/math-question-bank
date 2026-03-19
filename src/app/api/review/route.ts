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

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const schedules = await db.reviewSchedule.findMany({
    where: {
      accountId,
      dueDate: { lte: today },
    },
    include: {
      question: {
        include: {
          tags: { include: { tag: true } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
    take: 30,
  });

  return NextResponse.json({
    schedules,
    count: schedules.length,
  });
}
