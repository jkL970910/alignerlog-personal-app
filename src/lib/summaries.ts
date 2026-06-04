import { differenceInMinutes, isAfter, isBefore } from "date-fns";

import { dateKeysBetween, dayBounds, elapsedMinutesInDay, minutesInDay, parseDateKey, todayKey } from "./dates";
import type { DailySummary, OffTraySession, TreatmentPlan } from "./types";

type SplitSession = {
  date: string;
  minutes: number;
};

export function splitSessionByDay(session: OffTraySession, now = new Date()): SplitSession[] {
  const start = new Date(session.startAt);
  const end = session.endAt ? new Date(session.endAt) : now;

  if (!isAfter(end, start)) {
    return [];
  }

  const firstDay = parseDateKey(dateKeyFromDate(start));
  const lastDay = parseDateKey(dateKeyFromDate(end));

  return dateKeysBetween(firstDay, lastDay).map((date) => {
    const bounds = dayBounds(date);
    const segmentStart = isAfter(start, bounds.start) ? start : bounds.start;
    const segmentEnd = isBefore(end, bounds.end) ? end : bounds.end;
    const minutes = Math.max(0, differenceInMinutes(segmentEnd, segmentStart));

    return { date, minutes };
  }).filter((split) => split.minutes > 0);
}

export function calculateDailySummary(params: {
  date: string;
  sessions: OffTraySession[];
  treatmentPlan: Pick<TreatmentPlan, "dailyGoalMinutes" | "currentTrayNumber">;
  now?: Date;
}): DailySummary {
  const now = params.now ?? new Date();
  const offParts = params.sessions.flatMap((session) => splitSessionByDay(session, now));
  const offMinutes = offParts
    .filter((part) => part.date === params.date)
    .reduce((total, part) => total + part.minutes, 0);
  const sessionCount = params.sessions.filter((session) => {
    const start = new Date(session.startAt);
    const end = session.endAt ? new Date(session.endAt) : now;
    const bounds = dayBounds(params.date);

    return isBefore(start, bounds.end) && isAfter(end, bounds.start);
  }).length;
  const longestOffSessionMinutes = offParts
    .filter((part) => part.date === params.date)
    .reduce((longest, part) => Math.max(longest, part.minutes), 0);
  const hasData = sessionCount > 0 || offMinutes > 0;
  const dayElapsed = elapsedMinutesInDay(params.date, now);
  const wearMinutes = hasData ? clamp(dayElapsed - offMinutes, 0, minutesInDay(params.date)) : 0;

  return {
    date: params.date,
    offMinutes,
    wearMinutes,
    goalMinutes: params.treatmentPlan.dailyGoalMinutes,
    trayNumber: params.treatmentPlan.currentTrayNumber,
    sessionCount,
    longestOffSessionMinutes,
    goalMet: hasData && wearMinutes >= params.treatmentPlan.dailyGoalMinutes,
    hasData
  };
}

export function calculateDailySummaries(params: {
  startDate: string;
  endDate: string;
  sessions: OffTraySession[];
  treatmentPlan: Pick<TreatmentPlan, "dailyGoalMinutes" | "currentTrayNumber">;
  now?: Date;
}) {
  return dateKeysBetween(parseDateKey(params.startDate), parseDateKey(params.endDate))
    .filter((date) => date <= todayKey(params.now))
    .map((date) => calculateDailySummary({
      date,
      sessions: params.sessions,
      treatmentPlan: params.treatmentPlan,
      now: params.now
    }));
}

export function calculateHistoryMetrics(summaries: DailySummary[]) {
  const dated = summaries.filter((summary) => summary.hasData).sort((a, b) => a.date.localeCompare(b.date));
  const last7 = dated.slice(-7);
  const last30 = dated.slice(-30);
  const goalDays = dated.filter((summary) => summary.goalMet).length;
  const totalSessions = dated.reduce((total, summary) => total + summary.sessionCount, 0);
  const totalOffMinutes = dated.reduce((total, summary) => total + summary.offMinutes, 0);

  return {
    sevenDayAverage: average(last7.map((summary) => summary.wearMinutes)),
    thirtyDayAverage: average(last30.map((summary) => summary.wearMinutes)),
    goalAchievementRate: dated.length ? (goalDays / dated.length) * 100 : 0,
    longestGoalStreak: longestStreak(dated),
    averageOffTrayDuration: totalSessions ? totalOffMinutes / totalSessions : 0,
    longestOffTraySession: dated.reduce((longest, summary) => Math.max(longest, summary.longestOffSessionMinutes), 0)
  };
}

function dateKeyFromDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function average(values: number[]) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((total, value) => total + value, 0) / values.length;
}

function longestStreak(summaries: DailySummary[]) {
  let current = 0;
  let longest = 0;

  summaries.forEach((summary) => {
    if (summary.goalMet) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  });

  return longest;
}

function clamp(value: number, low: number, high: number) {
  return Math.min(Math.max(value, low), high);
}
