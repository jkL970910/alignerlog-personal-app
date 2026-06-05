import { addDaysToDateKey, todayKey } from "@/lib/dates";
import { calculateDailySummary } from "@/lib/summaries";
import type { OffTrayReason } from "@/lib/types";
import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import {
  createWearActionLog,
  endActiveOffTraySession,
  getActiveSession,
  getOrCreateTreatmentPlan,
  listSessionsForRange,
  startOffTraySession
} from "@/server/repository";
import { getRequestTimeZone } from "@/server/time-zone";

export const runtime = "nodejs";

type ToggleRequest = {
  action: "start" | "end";
  reason?: OffTrayReason;
};

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const timeZone = getRequestTimeZone(request);
    const body = await request.json() as ToggleRequest;
    const action = body.action === "start" ? "start" : "end";
    const result = action === "start"
      ? await startOffTraySession(userId, body.reason)
      : await endActiveOffTraySession(userId);
    await createWearActionLog({
      userId,
      action,
      changed: result.changed,
      sessionId: result.activeSession?.id ?? result.wearState.currentOffSessionId,
      resultingIsWearing: result.wearState.isWearing,
      requestId: request.headers.get("x-vercel-id") ?? request.headers.get("x-request-id"),
      source: request.headers.get("x-loo-source") ?? "today-dashboard",
      userAgent: request.headers.get("user-agent"),
      referer: request.headers.get("referer")
    }).catch((error) => {
      console.error("Failed to create wear action log.", error);
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
      timeZone,
      hasTrackingStarted: true
    });

    return apiJson({
      ...result,
      activeSession: await getActiveSession(userId),
      todaySummary
    });
  } catch (error) {
    return apiError(error);
  }
}
