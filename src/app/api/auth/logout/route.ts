import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST(_request: NextRequest) {
  const res = NextResponse.json({ ok: true });
  const cookie = clearSessionCookie();
  res.cookies.set(cookie.name, "", cookie.options);
  return res;
}

