import { NextResponse } from "next/server";
import { z } from "zod";

import { createSessionToken, sessionCookieName, sessionCookieOptions, verifyLoginPassword } from "@/server/auth";

export const runtime = "nodejs";

const loginSchema = z.object({
  password: z.string().min(1)
});

export async function POST(request: Request) {
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success || !verifyLoginPassword(parsed.data.password)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, createSessionToken(), sessionCookieOptions());

  return response;
}
