import { addDaysToDateKey, todayKey } from "@/lib/dates";
import { calculateDailySummary } from "@/lib/summaries";
import { calculatePlanProgress } from "@/lib/treatment-plan";
import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import {
  getActiveSession,
  getActiveTreatmentSeries,
  getOrCreateReminderSettings,
  getOrCreateTreatmentPlan,
  getTrackingStartedAt,
  getWearState,
  listActiveTreatmentExceptionEvents,
  listPlannedTraysForSeries,
  listSessionsForRange
} from "@/server/repository";
import { getRequestTimeZone } from "@/server/time-zone";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const timeZone = getRequestTimeZone(request);
    const now = new Date();
    const date = todayKey(now, timeZone);
    const treatmentPlan = await getOrCreateTreatmentPlan(userId);
    const persistedWearState = await getWearState(userId);
    const trackingStartedAt = await getTrackingStartedAt(userId);
    const reminderSettings = await getOrCreateReminderSettings(userId);
    const activeSession = await getActiveSession(userId);
    const wearState = activeSession
      ? {
        id: persistedWearState?.id ?? "derived-active-session",
        userId,
        isWearing: false,
        currentOffSessionId: activeSession.id,
        lastChangedAt: activeSession.startAt,
        updatedAt: activeSession.updatedAt
      }
      : persistedWearState ?? {
        id: "not-started",
        userId,
        isWearing: true,
        currentOffSessionId: null,
        lastChangedAt: now.toISOString(),
        updatedAt: now.toISOString()
      };
    const activeSeries = await getActiveTreatmentSeries(userId);
    const plannedTrays = activeSeries ? await listPlannedTraysForSeries(userId, activeSeries.id) : [];
    const sessions = await listSessionsForRange(userId, addDaysToDateKey(date, -1), date, timeZone);
    const todaySummary = calculateDailySummary({
      date,
      sessions,
      treatmentPlan,
      now,
      timeZone,
      hasTrackingStarted: Boolean(persistedWearState),
      trackingStartedAt
    });
    const planProgress = activeSeries ? calculatePlanProgress({
      status: activeSeries.status,
      currentTrayNumber: activeSeries.currentTrayNumber,
      totalTrays: activeSeries.totalTrays,
      overallTotalTrays: activeSeries.overallTotalTrays,
      overallTreatmentDays: activeSeries.overallTreatmentDays,
      trayIntervalDays: activeSeries.trayIntervalDays,
      currentTrayStartDate: activeSeries.currentTrayStartDate,
      nextChangeDate: activeSeries.nextChangeDate,
      trays: plannedTrays,
      todayKey: date
    }) : null;
    const activeExceptions = activeSeries ? await listActiveTreatmentExceptionEvents(userId, activeSeries.id, 3) : [];

    return apiJson({
      wearState,
      treatmentPlan,
      reminderSettings,
      activeSession,
      todaySummary,
      planProgress,
      activeException: activeExceptions[0] ?? null,
      recentExceptions: activeExceptions
    });
  } catch (error) {
    return apiError(error);
  }
}
