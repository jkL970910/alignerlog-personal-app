import { addDaysToDateKey, localDateTimeToUtc, todayKey } from "@/lib/dates";
import { calculateDailySummary } from "@/lib/summaries";
import type { OffTrayReason } from "@/lib/types";
import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import {
  backfillWearTrackingStart,
  createManualOffTraySession,
  createWearActionLog,
  endActiveOffTraySessionAt,
  startManualActiveOffTraySession,
  getActiveSession,
  getOrCreateTreatmentPlan,
  getOrCreateWearState,
  getTrackingStartedAt,
  listSessionsForRange
} from "@/server/repository";
import { getRequestTimeZone } from "@/server/time-zone";

export const runtime = "nodejs";

type ManualSessionRequest = {
  mode?: "closed_session" | "forgot_take_off_open" | "forgot_put_back" | "wearing_baseline";
  startLocal?: string;
  endLocal?: string;
  reason?: OffTrayReason;
};

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const timeZone = getRequestTimeZone(request);
    const body = await request.json() as ManualSessionRequest;
    const mode = body.mode ?? "closed_session";
    const result = await runManualCorrection({
      mode,
      userId,
      startLocal: body.startLocal,
      endLocal: body.endLocal,
      reason: body.reason,
      timeZone,
      request
    });
    const session = "session" in result ? result.session : null;
    const wearState = "wearState" in result ? result.wearState : await getOrCreateWearState(userId);

    if (session) {
      await createWearActionLog({
        userId,
        action: mode === "forgot_put_back" ? "end" : "start",
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
    }

    const now = new Date();
    const date = todayKey(now, timeZone);
    const treatmentPlan = await getOrCreateTreatmentPlan(userId);
    const trackingStartedAt = await getTrackingStartedAt(userId);
    const sessions = await listSessionsForRange(userId, addDaysToDateKey(date, -1), date, timeZone);
    const todaySummary = calculateDailySummary({
      date,
      sessions,
      treatmentPlan,
      now,
      timeZone,
      hasTrackingStarted: true,
      trackingStartedAt
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

function runManualCorrection(params: {
  mode: NonNullable<ManualSessionRequest["mode"]>;
  userId: string;
  startLocal?: string;
  endLocal?: string;
  reason?: OffTrayReason;
  timeZone: string;
  request: Request;
}) {
  if (params.mode === "wearing_baseline") {
    return backfillWearTrackingStart({
      userId: params.userId,
      startedAt: localDateTimeToUtc(params.startLocal ?? "", params.timeZone),
      source: "manual-wearing-baseline",
      userAgent: params.request.headers.get("user-agent"),
      referer: params.request.headers.get("referer")
    });
  }

  if (params.mode === "forgot_take_off_open") {
    return startManualActiveOffTraySession({
      userId: params.userId,
      startAt: localDateTimeToUtc(params.startLocal ?? "", params.timeZone),
      reason: params.reason
    });
  }

  if (params.mode === "forgot_put_back") {
    return endActiveOffTraySessionAt({
      userId: params.userId,
      endAt: localDateTimeToUtc(params.endLocal ?? "", params.timeZone)
    });
  }

  return createManualOffTraySession({
    userId: params.userId,
    startAt: localDateTimeToUtc(params.startLocal ?? "", params.timeZone),
    endAt: localDateTimeToUtc(params.endLocal ?? "", params.timeZone),
    reason: params.reason
  });
}
