import { subDays } from "date-fns";

import { todayKey, toDateKey } from "@/lib/dates";
import { calculateDailySummaries, calculateHistoryMetrics } from "@/lib/summaries";
import { apiError, apiJson } from "@/server/http";
import { getPersonalUserId } from "@/server/personal-user";
import { getOrCreateTreatmentPlan, listSessionsForRange } from "@/server/repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const userId = getPersonalUserId();
    const url = new URL(request.url);
    const now = new Date();
    const endDate = url.searchParams.get("end") ?? todayKey(now);
    const startDate = url.searchParams.get("start") ?? toDateKey(subDays(now, 29));
    const treatmentPlan = await getOrCreateTreatmentPlan(userId);
    const sessions = await listSessionsForRange(userId, startDate, endDate);
    const summaries = calculateDailySummaries({
      startDate,
      endDate,
      sessions,
      treatmentPlan,
      now
    });
    const metrics = calculateHistoryMetrics(summaries);

    return apiJson({ summaries, metrics });
  } catch (error) {
    return apiError(error);
  }
}
