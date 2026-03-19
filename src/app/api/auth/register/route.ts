import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    const u = String(username ?? "").trim();
    const p = String(password ?? "");

    if (!u || u.length < 3 || u.length > 30) {
      return NextResponse.json({ error: "用户名长度需在 3-30 之间" }, { status: 400 });
    }
    if (!p || p.length < 6) {
      return NextResponse.json({ error: "密码长度至少 6 位" }, { status: 400 });
    }

    const existing = await db.account.findUnique({ where: { username: u } });
    if (existing) {
      return NextResponse.json({ error: "用户名已存在" }, { status: 409 });
    }

    await db.account.create({
      data: {
        username: u,
        passwordHash: hashPassword(p),
      },
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (e) {
    console.error("register error:", e);
    return NextResponse.json({ error: "注册失败" }, { status: 500 });
  }
}

