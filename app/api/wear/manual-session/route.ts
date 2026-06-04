import { addDaysToDateKey, localDateTimeToUtc, todayKey } from "@/lib/dates";
import { calculateDailySummary } from "@/lib/summaries";
import type { OffTrayReason } from "@/lib/types";
import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import {
  createManualOffTraySession,
  createWearActionLog,
  getActiveSession,
  getOrCreateTreatmentPlan,
  getOrCreateWearState,
  listSessionsForRange
} from "@/server/repository";
import { getRequestTimeZone } from "@/server/time-zone";

export const runtime = "nodejs";

type ManualSessionRequest = {
  startLocal: string;
  endLocal: string;
  reason?: OffTrayReason;
};

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const timeZone = getRequestTimeZone(request);
    const body = await request.json() as ManualSessionRequest;
    const session = await createManualOffTraySession({
      userId,
      startAt: localDateTimeToUtc(body.startLocal, timeZone),
      endAt: localDateTimeToUtc(body.endLocal, timeZone),
      reason: body.reason
    });
    const wearState = await getOrCreateWearState(userId);
    await createWearActionLog({
      userId,
      action: "start",
      changed: true,
      sessionId: session.id,
      resultingIsWearing: wearState.isWearing,
      requestId: request.headers.get("x-vercel-id") ?? request.headers.get("x-request-id"),
      source: request.headers.get("x-loo-source") ?? "manual-off-tray-session",
      userAgent: request.headers.get("user-agent"),
      referer: request.headers.get("referer")
    }).catch((error) => {
      console.error("Failed to create manual wear action log.", error);
    });

    const now = new Date();
    const date = todayKey(now, timeZone);
    const treatmentPlan = await getOrCreateTreatmentPlan(userId);
    const sessions = await listSessionsForRange(userId, addDaysToDateKey(date, -1), date, timeZone);
    const todaySummary = calculateDailySummary({
      date,
      sessions,
      treatmentPlan,
      now,
      timeZone
    });

    return apiJson({
      session,
      wearState,
      activeSession: await getActiveSession(userId),
      todaySummary
    });
  } catch (error) {
    return apiError(error);
  }
}
