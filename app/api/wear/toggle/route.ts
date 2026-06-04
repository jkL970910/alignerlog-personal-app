import { todayKey, toDateKey } from "@/lib/dates";
import { calculateDailySummary } from "@/lib/summaries";
import type { OffTrayReason } from "@/lib/types";
import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import {
  endActiveOffTraySession,
  getActiveSession,
  getOrCreateTreatmentPlan,
  listSessionsForRange,
  startOffTraySession
} from "@/server/repository";
import { subDays } from "date-fns";

export const runtime = "nodejs";

type ToggleRequest = {
  action: "start" | "end";
  reason?: OffTrayReason;
};

export async function POST(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const body = await request.json() as ToggleRequest;
    const result = body.action === "start"
      ? await startOffTraySession(userId, body.reason)
      : await endActiveOffTraySession(userId);
    const now = new Date();
    const date = todayKey(now);
    const treatmentPlan = await getOrCreateTreatmentPlan(userId);
    const sessions = await listSessionsForRange(userId, toDateKey(subDays(now, 1)), date);
    const todaySummary = calculateDailySummary({
      date,
      sessions,
      treatmentPlan,
      now
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
