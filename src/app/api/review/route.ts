import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const DEFAULT_USER_ID = "user-default";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId") ?? DEFAULT_USER_ID;

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const schedules = await db.reviewSchedule.findMany({
    where: {
      userId,
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
