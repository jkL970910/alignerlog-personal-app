import { subDays } from "date-fns";

import { todayKey, toDateKey } from "@/lib/dates";
import { calculateDailySummary } from "@/lib/summaries";
import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import {
  getActiveSession,
  getOrCreateReminderSettings,
  getOrCreateTreatmentPlan,
  getOrCreateWearState,
  listSessionsForRange
} from "@/server/repository";

export const runtime = "nodejs";

export async function GET() {
  try {
    const userId = await requireCurrentUserId();
    const now = new Date();
    const date = todayKey(now);
    const treatmentPlan = await getOrCreateTreatmentPlan(userId);
    const wearState = await getOrCreateWearState(userId);
    const reminderSettings = await getOrCreateReminderSettings(userId);
    const activeSession = await getActiveSession(userId);
    const sessions = await listSessionsForRange(userId, toDateKey(subDays(now, 1)), date);
    const todaySummary = calculateDailySummary({
      date,
      sessions,
      treatmentPlan,
      now
    });

    return apiJson({
      wearState,
      treatmentPlan,
      reminderSettings,
      activeSession,
      todaySummary
    });
  } catch (error) {
    return apiError(error);
  }
}
