import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/adminAuth";

export async function GET(request: NextRequest) {
  const accountId = await requireAdmin(request);
  if (!accountId) {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  const collections = await db.collection.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      account: {
        select: { id: true, username: true },
      },
      _count: { select: { questions: true } },
    },
  });

  return NextResponse.json({ collections });
}
