import { NextResponse } from "next/server";

export function apiJson<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  const status = message === "Unauthorized."
    ? 401
    : message.includes("DATABASE_URL")
      ? 503
      : message.includes("重叠") || message.includes("已有牙套计划") || message.includes("No active treatment plan")
        ? 409
        : message.includes("补记") || message.includes("时间")
          ? 400
        : 500;

  return NextResponse.json({ error: message }, { status });
}
