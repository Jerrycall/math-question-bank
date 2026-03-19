import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, isAdminUsername } from "@/lib/adminAuth";

export async function GET(request: NextRequest) {
  const accountId = await requireAdmin(request);
  if (!accountId) {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  const rows = await db.account.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      username: true,
      createdAt: true,
      _count: { select: { collections: true } },
    },
  });

  const accounts = rows.map((a) => ({
    ...a,
    isAdmin: isAdminUsername(a.username),
  }));

  return NextResponse.json({ accounts });
}

export async function DELETE(request: NextRequest) {
  const adminAccountId = await requireAdmin(request);
  if (!adminAccountId) {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  let body: { ids?: string[]; checkbox_confirm?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体无效" }, { status: 400 });
  }

  const ids = Array.isArray(body.ids) ? body.ids : [];
  const checkboxConfirm = body.checkbox_confirm === true;

  if (!checkboxConfirm) {
    return NextResponse.json(
      { error: "请勾选确认后再执行删除" },
      { status: 400 }
    );
  }

  if (ids.length === 0) {
    return NextResponse.json({ error: "请选择要删除的账号" }, { status: 400 });
  }

  // 禁止删除当前登录账号
  if (ids.includes(adminAccountId)) {
    return NextResponse.json(
      { error: "不能删除当前登录的管理员账号" },
      { status: 400 }
    );
  }

  // 禁止删除白名单中的管理员
  const toDelete = await db.account.findMany({
    where: { id: { in: ids } },
    select: { id: true, username: true },
  });
  for (const a of toDelete) {
    if (isAdminUsername(a.username)) {
      return NextResponse.json(
        { error: `不能删除管理员账号：${a.username}` },
        { status: 400 }
      );
    }
  }

  await db.account.deleteMany({ where: { id: { in: ids } } });
  return NextResponse.json({ ok: true, deleted: ids.length });
}
