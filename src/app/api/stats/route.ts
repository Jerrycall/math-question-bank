import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { subDays, format } from "date-fns";
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

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") ?? "30");

  const startDate = subDays(new Date(), days);

  const [totalRecords, masteryData, recentRecords, reviewCount] =
    await Promise.all([
      db.learningRecord.aggregate({
        where: { accountId },
        _count: { id: true },
        _sum: { timeSpentS: true },
      }),
      db.knowledgeMastery.findMany({
        where: { accountId },
        include: { tag: true },
        orderBy: { masteryScore: "desc" },
        take: 12,
      }),
      db.learningRecord.findMany({
        where: { accountId, answeredAt: { gte: startDate } },
        orderBy: { answeredAt: "asc" },
      }),
      db.reviewSchedule.count({
        where: {
          accountId,
          dueDate: { lte: new Date() },
        },
      }),
    ]);

  // 计算每日统计
  const dailyMap = new Map<string, { total: number; correct: number }>();
  for (const r of recentRecords) {
    const dateKey = format(new Date(r.answeredAt), "MM/dd");
    const current = dailyMap.get(dateKey) ?? { total: 0, correct: 0 };
    dailyMap.set(dateKey, {
      total: current.total + 1,
      correct: current.correct + (r.isCorrect ? 1 : 0),
    });
  }

  const dailyStats = Array.from(dailyMap.entries()).map(([date, { total, correct }]) => ({
    date,
    accuracy: Math.round((correct / total) * 100),
    count: total,
  }));

  const totalAttempts = totalRecords._count.id;
  const correctAttempts = recentRecords.filter((r) => r.isCorrect).length;

  return NextResponse.json({
    overview: {
      totalAttempts,
      totalTimeS: totalRecords._sum.timeSpentS ?? 0,
      pendingReview: reviewCount,
      overallAccuracy:
        totalAttempts > 0
          ? Math.round((correctAttempts / totalAttempts) * 100)
          : 0,
    },
    masteryData,
    dailyStats,
  });
}
