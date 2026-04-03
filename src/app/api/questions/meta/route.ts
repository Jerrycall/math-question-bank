import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/** 题库筛选用元数据：如有来源年份的题目列表等 */
export async function GET() {
  try {
    const withYear = await db.question.findMany({
      where: { sourceYear: { not: null } },
      select: { sourceYear: true },
    });
    const yearSet = new Set<number>();
    for (const r of withYear) {
      if (typeof r.sourceYear === "number") yearSet.add(r.sourceYear);
    }
    const sourceYears = Array.from(yearSet).sort((a, b) => b - a);

    return NextResponse.json({ sourceYears });
  } catch (e) {
    console.error("[api/questions/meta] error:", e);
    return NextResponse.json({ sourceYears: [] as number[] });
  }
}
