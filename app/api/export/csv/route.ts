import { addDaysToDateKey, todayKey } from "@/lib/dates";
import { calculateDailySummaries } from "@/lib/summaries";
import { requireCurrentUserId } from "@/server/auth";
import { apiError } from "@/server/http";
import { getOrCreateTreatmentPlan, listSessionsForRange } from "@/server/repository";
import { getRequestTimeZone } from "@/server/time-zone";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const url = new URL(request.url);
    const timeZone = getRequestTimeZone(request);
    const now = new Date();
    const endDate = url.searchParams.get("end") ?? todayKey(now, timeZone);
    const startDate = url.searchParams.get("start") ?? addDaysToDateKey(endDate, -365);
    const treatmentPlan = await getOrCreateTreatmentPlan(userId);
    const sessions = await listSessionsForRange(userId, startDate, endDate, timeZone);
    const summaries = calculateDailySummaries({
      startDate,
      endDate,
      sessions,
      treatmentPlan,
      now,
      timeZone
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
