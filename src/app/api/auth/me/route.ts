import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token) {
      return NextResponse.json({ user: null }, { status: 401 });
    }
    const accountId = verifySession(token);
    if (!accountId) {
      return NextResponse.json({ user: null }, { status: 401 });
    }
    const account = await db.account.findUnique({
      where: { id: accountId },
      select: { id: true, username: true, createdAt: true },
    });
    return NextResponse.json({ user: account ?? null });
  } catch (e) {
    console.error("me error:", e);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}

