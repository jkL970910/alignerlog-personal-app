import { NextResponse } from "next/server";
import { z } from "zod";

import { createSessionToken, getConfiguredUserId, hashPassword, normalizeEmail, sessionCookieName, sessionCookieOptions } from "@/server/auth";
import { countUsers, createUser, createUserWithId, getUserByEmail } from "@/server/repository";

export const runtime = "nodejs";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export async function POST(request: Request) {
  const parsed = registerSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Use a valid email and an 8+ character password." }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const existing = await getUserByEmail(email);

  if (existing) {
    return NextResponse.json({ error: "An account already exists for this email." }, { status: 409 });
  }

  const passwordHash = hashPassword(parsed.data.password);
  const user = await countUsers() === 0
    ? await createUserWithId(getConfiguredUserId(), email, passwordHash)
    : await createUser(email, passwordHash);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, createSessionToken(user.id), sessionCookieOptions());

  return response;
}
