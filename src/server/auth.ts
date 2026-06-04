import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";


export const sessionCookieName = "alignerlog_session";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;

function getAuthSecret() {
  const secret = process.env.ALIGNERLOG_AUTH_SECRET;

  if (!secret || secret.trim().length < 32) {
    throw new Error("ALIGNERLOG_AUTH_SECRET must be at least 32 characters.");
  }

  return secret.trim();
}

export function getConfiguredUserId() {
  return process.env.ALIGNERLOG_USER_ID ?? "00000000-0000-0000-0000-000000000001";
}

function getLoginPassword() {
  const password = process.env.ALIGNERLOG_LOGIN_PASSWORD;

  if (!password || password.length < 8) {
    throw new Error("ALIGNERLOG_LOGIN_PASSWORD must be at least 8 characters.");
  }

  return password;
}

function sign(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, 64).toString("base64url");

  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split("$");

  if (algorithm !== "scrypt" || !salt || !hash) {
    return false;
  }

  const candidate = scryptSync(password, salt, 64).toString("base64url");

  return constantTimeEqual(candidate, hash);
}

export function createSessionToken(userId = getConfiguredUserId()) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({ userId, issuedAt }), "utf8").toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token: string | undefined | null) {
  if (!token) {
    return null;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature || !constantTimeEqual(sign(payload), signature)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: string;
      issuedAt?: number;
    };
    const now = Math.floor(Date.now() / 1000);

    if (!parsed.userId || !parsed.issuedAt || now - parsed.issuedAt > sessionMaxAgeSeconds) {
      return null;
    }

    return { userId: parsed.userId };
  } catch {
    return null;
  }
}

export function verifyLoginPassword(password: string) {
  return constantTimeEqual(password, getLoginPassword());
}

export async function getCurrentUserId() {
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(sessionCookieName)?.value);

  return session?.userId ?? null;
}

export async function requireCurrentUserId() {
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Unauthorized.");
  }

  const { getUserById } = await import("./repository");
  const user = await getUserById(userId);

  if (!user) {
    throw new Error("Unauthorized.");
  }

  return userId;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: sessionMaxAgeSeconds,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production"
  };
}
