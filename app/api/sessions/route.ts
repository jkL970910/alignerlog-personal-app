import { z } from "zod";

import { localDateTimeToUtc } from "@/lib/dates";
import type { OffTrayReason } from "@/lib/types";
import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { createManualOffTraySession, listSessionsForDate } from "@/server/repository";
import { getRequestTimeZone } from "@/server/time-zone";

export const runtime = "nodejs";

const listSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

const createSchema = z.object({
  startLocal: z.string(),
  endLocal: z.string(),
  reason: z.enum(["meal", "drink", "brushing", "other"]).optional()
});

export async function GET(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const timeZone = getRequestTimeZone(request);
    const url = new URL(request.url);
    const parsed = listSchema.parse({ date: url.searchParams.get("date") });
    const sessions = await listSessionsForDate(userId, parsed.date, timeZone);

    return apiJson({ sessions });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const timeZone = getRequestTimeZone(request);
    const parsed = createSchema.parse(await request.json());
    const session = await createManualOffTraySession({
      userId,
      startAt: localDateTimeToUtc(parsed.startLocal, timeZone),
      endAt: localDateTimeToUtc(parsed.endLocal, timeZone),
      reason: parsed.reason as OffTrayReason | undefined
    });

    return apiJson({ session });
  } catch (error) {
    return apiError(error);
  }
}
