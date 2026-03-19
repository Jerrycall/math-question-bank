import crypto from "crypto";

const SESSION_COOKIE_NAME = "session";

export const SESSION_COOKIE = SESSION_COOKIE_NAME;

const DEFAULT_PBKDF2_ITERATIONS = 310_000;

function base64UrlEncode(input: Buffer) {
  return input.toString("base64url");
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, "base64url");
}

function getSessionSecret(): string {
  // 优先使用 SESSION_SECRET；若本地尚未配置，可降级到 NEXTAUTH_SECRET 以避免开发期直接崩溃
  const secret = process.env.SESSION_SECRET || process.env.NEXTAUTH_SECRET || "dev-secret";
  if (!secret?.trim()) return "dev-secret";
  return secret;
}

export function hashPassword(
  password: string,
  iterations = DEFAULT_PBKDF2_ITERATIONS
): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .pbkdf2Sync(password, salt, iterations, 32, "sha256")
    .toString("hex");
  // salt:iterations:hash
  return `${salt}:${iterations}:${hash}`;
}

export function verifyPassword(
  password: string,
  passwordHash: string
): boolean {
  const parts = passwordHash.split(":");
  if (parts.length !== 3) return false;
  const [salt, iterStr, expectedHash] = parts;
  const iterations = Number(iterStr);
  if (!salt || !Number.isFinite(iterations) || !expectedHash) return false;

  const hash = crypto
    .pbkdf2Sync(password, salt, iterations, 32, "sha256")
    .toString("hex");

  // timing-safe compare
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedHash));
}

export function signSession(accountId: string): string {
  const secret = getSessionSecret();
  const payload = base64UrlEncode(Buffer.from(accountId, "utf8"));
  const hmac = crypto.createHmac("sha256", secret).update(accountId).digest("hex");
  return `${payload}.${hmac}`;
}

export function verifySession(token: string): string | null {
  try {
    const secret = getSessionSecret();
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, providedHmac] = parts;
    const accountId = base64UrlDecode(payload).toString("utf8");
    const expectedHmac = crypto.createHmac("sha256", secret).update(accountId).digest("hex");
    if (!accountId) return null;
    if (providedHmac.length !== expectedHmac.length) return null;
    return crypto.timingSafeEqual(
      Buffer.from(providedHmac),
      Buffer.from(expectedHmac)
    )
      ? accountId
      : null;
  } catch {
    return null;
  }
}

export function clearSessionCookie() {
  return {
    name: SESSION_COOKIE_NAME,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      maxAge: 0,
    },
  };
}

export function setSessionCookie(sessionToken: string) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    name: SESSION_COOKIE_NAME,
    value: sessionToken,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: isProd,
      // 30 days
      maxAge: 60 * 60 * 24 * 30,
    },
  };
}

