import { NextResponse } from "next/server";
import { z } from "zod";

import { createSessionToken, normalizeEmail, sessionCookieName, sessionCookieOptions, verifyLoginPassword, verifyPassword } from "@/server/auth";
import { getUserByEmail } from "@/server/repository";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(1)
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  if (parsed.data.email) {
    const user = await getUserByEmail(normalizeEmail(parsed.data.email));

    if (!user || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(sessionCookieName, createSessionToken(user.id), sessionCookieOptions());

    return response;
  }

  if (!verifyLoginPassword(parsed.data.password)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, createSessionToken(), sessionCookieOptions());

  return response;
}
