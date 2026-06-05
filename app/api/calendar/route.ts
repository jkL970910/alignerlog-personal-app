import { addDays, endOfMonth, startOfMonth, startOfWeek } from "date-fns";

import { dateKeysBetween, parseDateKey, todayKey, toDateKey } from "@/lib/dates";
import { calculateDailySummary } from "@/lib/summaries";
import type { CalendarTrayEvent, DailyNote, PlannedTray } from "@/lib/types";
import { requireCurrentUserId } from "@/server/auth";
import { apiError, apiJson } from "@/server/http";
import {
  getActiveTreatmentSeries,
  getOrCreateTreatmentPlan,
  getTrackingStartedAt,
  listDailyNotesForRange,
  listPlannedTraysForSeries,
  listSessionsForRange
} from "@/server/repository";
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
    const trackingStartedAt = await getTrackingStartedAt(userId);
    const activeSeries = await getActiveTreatmentSeries(userId);
    const plannedTrays = activeSeries ? await listPlannedTraysForSeries(userId, activeSeries.id) : [];
    const trayEventsByDate = buildTrayEventsByDate(plannedTrays);
    const sessions = await listSessionsForRange(userId, startDate, endDate, timeZone);
    const notes = await listDailyNotesForRange(userId, startDate, endDate);
    const notesByDate = buildNotesByDate(notes);
    const today = todayKey(new Date(), timeZone);

    return apiJson({
      month,
      startDate,
      endDate,
      days: dateKeysBetween(parseDateKey(startDate), parseDateKey(endDate)).map((date) => {
        const summary = date <= today
          ? calculateDailySummary({
            date,
            sessions,
            treatmentPlan,
            timeZone,
            hasTrackingStarted: Boolean(trackingStartedAt),
            trackingStartedAt
          })
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

        const dayNotes = notesByDate.get(date) ?? [];

        return {
          date,
          summary,
          note: dayNotes[0] ?? null,
          notes: dayNotes,
          trayEvents: trayEventsByDate.get(date) ?? [],
          hasData: hasCalendarData(summary, dayNotes.length > 0),
          status: getCalendarStatus(summary, dayNotes.length > 0)
        };
      })
    });
  } catch (error) {
    return apiError(error);
  }
}

function buildNotesByDate(notes: DailyNote[]) {
  const notesByDate = new Map<string, DailyNote[]>();

  notes.forEach((note) => {
    const values = notesByDate.get(note.date) ?? [];

    values.push(note);
    notesByDate.set(note.date, values);
  });

  return notesByDate;
}

function buildTrayEventsByDate(plannedTrays: PlannedTray[]) {
  const eventsByDate = new Map<string, CalendarTrayEvent[]>();

  plannedTrays.forEach((tray) => {
    addTrayEvent(eventsByDate, tray.plannedStartDate, {
      trayNumber: tray.trayNumber,
      kind: "start",
      label: `第 ${tray.trayNumber} 副开始`
    });
    addTrayEvent(eventsByDate, tray.plannedEndDate, {
      trayNumber: tray.trayNumber,
      kind: "end",
      label: `第 ${tray.trayNumber} 副结束`
    });
  });

  return eventsByDate;
}

function addTrayEvent(eventsByDate: Map<string, CalendarTrayEvent[]>, date: string, event: CalendarTrayEvent) {
  const events = eventsByDate.get(date) ?? [];

  events.push(event);
  eventsByDate.set(date, events);
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
