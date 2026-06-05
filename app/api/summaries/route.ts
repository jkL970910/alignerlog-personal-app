import { addDaysToDateKey, todayKey } from "@/lib/dates";
import { calculateDailySummaries, calculateHistoryMetrics } from "@/lib/summaries";
import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { getOrCreateTreatmentPlan, getTrackingStartedAt, listSessionsForRange } from "@/server/repository";
import { getRequestTimeZone } from "@/server/time-zone";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const url = new URL(request.url);
    const timeZone = getRequestTimeZone(request);
    const now = new Date();
    const endDate = url.searchParams.get("end") ?? todayKey(now, timeZone);
    const startDate = url.searchParams.get("start") ?? addDaysToDateKey(endDate, -29);
    const treatmentPlan = await getOrCreateTreatmentPlan(userId);
    const trackingStartedAt = await getTrackingStartedAt(userId);
    const sessions = await listSessionsForRange(userId, startDate, endDate, timeZone);
    const summaries = calculateDailySummaries({
      startDate,
      endDate,
      sessions,
      treatmentPlan,
      now,
      timeZone,
      hasTrackingStarted: Boolean(trackingStartedAt),
      trackingStartedAt
    });
    const today = todayKey(now, timeZone);
    const metrics = calculateHistoryMetrics(summaries, { today });

    return apiJson({ summaries, metrics, today });
  } catch (error) {
    return apiError(error);
  }
}
