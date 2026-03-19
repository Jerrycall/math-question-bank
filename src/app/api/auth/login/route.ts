import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { setSessionCookie, signSession, verifyPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    const u = String(username ?? "").trim();
    const p = String(password ?? "");

    if (!u || !p) {
      return NextResponse.json({ error: "用户名或密码不能为空" }, { status: 400 });
    }

    const account = await db.account.findUnique({ where: { username: u } });
    if (!account || !verifyPassword(p, account.passwordHash)) {
      return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
    }

    const sessionToken = signSession(account.id);
    const res = NextResponse.json({ ok: true });
    const cookie = setSessionCookie(sessionToken);
    res.cookies.set(cookie.name, cookie.value, cookie.options);
    return res;
  } catch (e) {
    console.error("login error:", e);
    return NextResponse.json({ error: "登录失败" }, { status: 500 });
  }
}

