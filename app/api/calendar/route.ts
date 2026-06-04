import { addDays, endOfMonth, startOfMonth, startOfWeek } from "date-fns";

import { dateKeysBetween, parseDateKey, todayKey, toDateKey } from "@/lib/dates";
import { calculateDailySummary } from "@/lib/summaries";
import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import { getOrCreateTreatmentPlan, listDailyNotesForRange, listSessionsForRange } from "@/server/repository";
import { getRequestTimeZone } from "@/server/time-zone";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const userId = await requireCurrentUserId();
    const url = new URL(request.url);
    const timeZone = getRequestTimeZone(request);
    const month = url.searchParams.get("month") ?? todayKey(new Date(), timeZone).slice(0, 7);
    const monthStart = startOfMonth(new Date(`${month}-01T00:00:00`));
    const gridStart = startOfWeek(monthStart);
    const gridEnd = addDays(startOfWeek(endOfMonth(monthStart)), 6);
    const startDate = toDateKey(gridStart);
    const endDate = toDateKey(gridEnd);
    const treatmentPlan = await getOrCreateTreatmentPlan(userId);
    const sessions = await listSessionsForRange(userId, startDate, endDate, timeZone);
    const notes = await listDailyNotesForRange(userId, startDate, endDate);
    const notesByDate = new Map(notes.map((note) => [note.date, note]));
    const today = todayKey(new Date(), timeZone);

    return apiJson({
      month,
      startDate,
      endDate,
      days: dateKeysBetween(parseDateKey(startDate), parseDateKey(endDate)).map((date) => {
        const summary = date <= today
          ? calculateDailySummary({ date, sessions, treatmentPlan, timeZone })
          : {
            date,
            offMinutes: 0,
            wearMinutes: 0,
            goalMinutes: treatmentPlan.dailyGoalMinutes,
            trayNumber: treatmentPlan.currentTrayNumber,
            sessionCount: 0,
            longestOffSessionMinutes: 0,
            goalMet: false,
            hasData: false
          };

        return {
          date,
          summary,
          note: notesByDate.get(date) ?? null,
          hasData: hasCalendarData(summary, Boolean(notesByDate.get(date))),
          status: getCalendarStatus(summary, Boolean(notesByDate.get(date)))
        };
      })
    });
  } catch (error) {
    return apiError(error);
  }
}

function hasCalendarData(summary: {
  offMinutes: number;
  sessionCount: number;
  hasData: boolean;
}, hasNote: boolean) {
  return hasNote || summary.hasData || summary.sessionCount > 0 || summary.offMinutes > 0;
}

function getCalendarStatus(summary: {
  offMinutes: number;
  sessionCount: number;
  wearMinutes: number;
  goalMinutes: number;
  goalMet: boolean;
  hasData: boolean;
}, hasNote: boolean) {
  if (!hasCalendarData(summary, hasNote)) {
    return "no_data";
  }

  if (summary.goalMet) {
    return "goal_met";
  }

  if (summary.wearMinutes >= summary.goalMinutes - 60) {
    return "close";
  }

  return "below_goal";
}
