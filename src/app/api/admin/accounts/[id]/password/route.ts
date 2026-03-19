import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requireAdmin, isAdminUsername } from "@/lib/adminAuth";

/**
 * 管理员为普通用户重置密码（不适用于 ADMIN_USERNAMES 中的账号）。
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminAccountId = await requireAdmin(request);
  if (!adminAccountId) {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  const { id: targetId } = await params;

  let body: { newPassword?: string; checkbox_confirm?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  }

  if (body.checkbox_confirm !== true) {
    return NextResponse.json(
      { error: "请勾选确认后再执行重置" },
      { status: 400 }
    );
  }

  const newPassword = String(body.newPassword ?? "");
  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json(
      { error: "新密码长度至少 6 位" },
      { status: 400 }
    );
  }

  const target = await db.account.findUnique({
    where: { id: targetId },
    select: { id: true, username: true },
  });
  if (!target) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 });
  }

  if (isAdminUsername(target.username)) {
    return NextResponse.json(
      {
        error:
          "不能通过后台重置管理员账号密码，请使用数据库或联系站主处理",
      },
      { status: 400 }
    );
  }

  await db.account.update({
    where: { id: targetId },
    data: { passwordHash: hashPassword(newPassword) },
  });

  return NextResponse.json({ ok: true });
}
