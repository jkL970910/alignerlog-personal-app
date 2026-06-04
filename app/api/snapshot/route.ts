import { subDays } from "date-fns";

import { todayKey, toDateKey } from "@/lib/dates";
import { calculateDailySummary } from "@/lib/summaries";
import { calculatePlanProgress } from "@/lib/treatment-plan";
import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import {
  getActiveSession,
  getActiveTreatmentSeries,
  getOrCreateReminderSettings,
  getOrCreateTreatmentPlan,
  getWearState,
  listPlannedTraysForSeries,
  listSessionsForRange
} from "@/server/repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await requireCurrentUserId();
    const now = new Date();
    const date = todayKey(now);
    const treatmentPlan = await getOrCreateTreatmentPlan(userId);
    const persistedWearState = await getWearState(userId);
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
    const sessions = await listSessionsForRange(userId, toDateKey(subDays(now, 1)), date);
    const todaySummary = calculateDailySummary({
      date,
      sessions,
      treatmentPlan,
      now
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
      today: now
    }) : null;

    return apiJson({
      wearState,
      treatmentPlan,
      reminderSettings,
      activeSession,
      todaySummary,
      planProgress
    });
  } catch (error) {
    return apiError(error);
  }
}
