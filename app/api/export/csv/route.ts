import { subDays } from "date-fns";

import { todayKey, toDateKey } from "@/lib/dates";
import { calculateDailySummaries } from "@/lib/summaries";
import { requireCurrentUserId } from "@/server/auth";
import { apiError } from "@/server/http";
import { getOrCreateTreatmentPlan, listSessionsForRange } from "@/server/repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const url = new URL(request.url);
    const now = new Date();
    const endDate = url.searchParams.get("end") ?? todayKey(now);
    const startDate = url.searchParams.get("start") ?? toDateKey(subDays(now, 365));
    const treatmentPlan = await getOrCreateTreatmentPlan(userId);
    const sessions = await listSessionsForRange(userId, startDate, endDate);
    const summaries = calculateDailySummaries({
      startDate,
      endDate,
      sessions,
      treatmentPlan,
      now
    });
    const rows = [
      ["date", "wearMinutes", "offMinutes", "goalMinutes", "sessionCount", "longestOffSessionMinutes", "goalMet"],
      ...summaries.map((summary) => [
        summary.date,
        summary.wearMinutes,
        summary.offMinutes,
        summary.goalMinutes,
        summary.sessionCount,
        summary.longestOffSessionMinutes,
        summary.goalMet
      ])
    ];
    const csv = rows.map((row) => row.map(String).join(",")).join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=alignerlog-daily-summaries.csv"
      }
    });
  } catch (error) {
    return apiError(error);
  }
}
