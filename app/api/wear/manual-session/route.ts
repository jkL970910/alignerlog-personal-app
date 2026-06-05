import { addDaysToDateKey, localDateTimeToUtc, todayKey } from "@/lib/dates";
import { calculateDailySummary } from "@/lib/summaries";
import type { OffTrayReason } from "@/lib/types";
import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import {
  createManualOffTraySession,
  createWearActionLog,
  startManualActiveOffTraySession,
  getActiveSession,
  getOrCreateTreatmentPlan,
  getOrCreateWearState,
  listSessionsForRange
} from "@/server/repository";
import { getRequestTimeZone } from "@/server/time-zone";

export const runtime = "nodejs";

type ManualSessionRequest = {
  mode?: "closed_session" | "forgot_put_back";
  startLocal: string;
  endLocal?: string;
  reason?: OffTrayReason;
};

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const timeZone = getRequestTimeZone(request);
    const body = await request.json() as ManualSessionRequest;
    const mode = body.mode ?? "closed_session";
    const startAt = localDateTimeToUtc(body.startLocal, timeZone);
    const result = mode === "forgot_put_back"
      ? await startManualActiveOffTraySession({
        userId,
        startAt,
        reason: body.reason
      })
      : await createManualOffTraySession({
        userId,
        startAt,
        endAt: localDateTimeToUtc(body.endLocal ?? "", timeZone),
        reason: body.reason
      });
    const session = "session" in result ? result.session : result;
    const wearState = "wearState" in result ? result.wearState : await getOrCreateWearState(userId);
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
      timeZone,
      hasTrackingStarted: true
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
