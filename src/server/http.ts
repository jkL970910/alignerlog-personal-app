import { NextResponse } from "next/server";

export function apiJson<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  const status = message === "Unauthorized." ? 401 : message.includes("DATABASE_URL") ? 503 : 500;

  return NextResponse.json({ error: message }, { status });
}
