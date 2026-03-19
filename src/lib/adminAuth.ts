import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

const ADMIN_USERNAMES_KEY = "ADMIN_USERNAMES";

function getAdminUsernames(): Set<string> {
  const raw = process.env[ADMIN_USERNAMES_KEY] ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

/**
 * 要求当前请求已登录且为管理员（用户名在 ADMIN_USERNAMES 环境变量中）。
 * 返回 accountId，否则返回 null。
 */
export async function requireAdmin(
  request: NextRequest
): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const accountId = verifySession(token);
  if (!accountId) return null;

  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { id: true, username: true },
  });
  if (!account) return null;

  const admins = getAdminUsernames();
  if (!admins.has(account.username.toLowerCase())) return null;

  return accountId;
}

export function isAdminUsername(username: string): boolean {
  return getAdminUsernames().has(username.trim().toLowerCase());
}

export { getAdminUsernames };
