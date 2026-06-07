import { differenceInMinutes, isAfter, isBefore } from "date-fns";

import { dateKeysBetweenKeys, dayBounds, elapsedMinutesInDay, minutesInDay, todayKey, toDateKey } from "./dates";
import type { DailySummary, OffTraySession, TreatmentPlan } from "./types";

type SplitSession = {
  date: string;
  minutes: number;
};

export function splitSessionByDay(session: OffTraySession, now = new Date(), timeZone = "UTC"): SplitSession[] {
  const start = new Date(session.startAt);
  const end = session.endAt ? new Date(session.endAt) : now;

  if (!isAfter(end, start)) {
    return [];
  }

  const firstDay = toDateKey(start, timeZone);
  const lastDay = toDateKey(end, timeZone);

  return dateKeysBetweenKeys(firstDay, lastDay).map((date) => {
    const bounds = dayBounds(date, timeZone);
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
  timeZone?: string;
  hasTrackingStarted?: boolean;
  trackingStartedAt?: string | Date | null;
}): DailySummary {
  const now = params.now ?? new Date();
  const timeZone = params.timeZone ?? "UTC";
  const bounds = dayBounds(params.date, timeZone);
  const trackingStartedAt = params.trackingStartedAt ? new Date(params.trackingStartedAt) : null;
  const offParts = params.sessions.flatMap((session) => splitSessionByDay(session, now, timeZone));
  const offMinutes = offParts
    .filter((part) => part.date === params.date)
    .reduce((total, part) => total + part.minutes, 0);
  const sessionCount = params.sessions.filter((session) => {
    const start = new Date(session.startAt);
    const end = session.endAt ? new Date(session.endAt) : now;
    return isBefore(start, bounds.end) && isAfter(end, bounds.start);
  }).length;
  const longestOffSessionMinutes = offParts
    .filter((part) => part.date === params.date)
    .reduce((longest, part) => Math.max(longest, part.minutes), 0);
  const hasTrackingStartedForDay = Boolean(params.hasTrackingStarted)
    && (!trackingStartedAt || isBefore(trackingStartedAt, bounds.end));
  const hasData = hasTrackingStartedForDay || sessionCount > 0 || offMinutes > 0;
  const dayStart = trackingStartedAt && isAfter(trackingStartedAt, bounds.start) && isBefore(trackingStartedAt, bounds.end)
    ? trackingStartedAt
    : bounds.start;
  const dayElapsed = hasData ? Math.max(0, differenceInMinutes(isBefore(now, bounds.end) ? now : bounds.end, dayStart)) : 0;
  const wearMinutes = hasData ? clamp(dayElapsed - offMinutes, 0, minutesInDay(params.date, timeZone)) : 0;

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
  timeZone?: string;
  hasTrackingStarted?: boolean;
  trackingStartedAt?: string | Date | null;
}) {
  const timeZone = params.timeZone ?? "UTC";

  return dateKeysBetweenKeys(params.startDate, params.endDate)
    .filter((date) => date <= todayKey(params.now, timeZone))
    .map((date) => calculateDailySummary({
      date,
      sessions: params.sessions,
      treatmentPlan: params.treatmentPlan,
      now: params.now,
      timeZone,
      hasTrackingStarted: params.hasTrackingStarted,
      trackingStartedAt: params.trackingStartedAt
    }));
}

export type MonthlyGoalStats = {
  month: string;
  goalMetDays: number;
  trackedDays: number;
  recordedDays: number;
  elapsedDays: number;
  recordedGoalRate: number;
  calendarGoalRate: number;
};

export type GoalStats = {
  goalMetDays: number;
  trackedDays: number;
  goalRate: number;
};

export type HistoryMetrics = {
  sevenDayAverage: number;
  thirtyDayAverage: number;
  goalAchievementRate: number;
  longestGoalStreak: number;
  currentGoalStreak: number;
  monthlyGoalStats: MonthlyGoalStats;
  overallGoalStats: GoalStats;
  averageOffTrayDuration: number;
  longestOffTraySession: number;
};

export function calculateHistoryMetrics(summaries: DailySummary[], options?: { today?: string }): HistoryMetrics {
  const completed = summaries
    .filter((summary) => !options?.today || summary.date < options.today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const dated = completed.filter((summary) => summary.hasData);
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
    currentGoalStreak: currentStreak(dated),
    monthlyGoalStats: calculateMonthlyGoalStats(completed, options?.today),
    overallGoalStats: calculateOverallGoalStats(dated),
    averageOffTrayDuration: totalSessions ? totalOffMinutes / totalSessions : 0,
    longestOffTraySession: dated.reduce((longest, summary) => Math.max(longest, summary.longestOffSessionMinutes), 0)
  };
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

function currentStreak(summaries: DailySummary[]) {
  let streak = 0;

  for (let index = summaries.length - 1; index >= 0; index -= 1) {
    if (!summaries[index].goalMet) {
      break;
    }

    streak += 1;
  }

  return streak;
}

function calculateMonthlyGoalStats(summaries: DailySummary[], today?: string): MonthlyGoalStats {
  const referenceDate = today ?? summaries[summaries.length - 1]?.date ?? todayKey();
  const month = referenceDate.slice(0, 7);
  const monthlySummaries = summaries
    .filter((summary) => summary.date.startsWith(`${month}-`) && summary.hasData);
  const goalMetDays = monthlySummaries.filter((summary) => summary.goalMet).length;
  const trackedDays = monthlySummaries.length;
  const goalRate = trackedDays ? (goalMetDays / trackedDays) * 100 : 0;

  return {
    month,
    goalMetDays,
    trackedDays,
    recordedDays: trackedDays,
    elapsedDays: trackedDays,
    recordedGoalRate: goalRate,
    calendarGoalRate: goalRate
  };
}

function calculateOverallGoalStats(summaries: DailySummary[]): GoalStats {
  const goalMetDays = summaries.filter((summary) => summary.goalMet).length;
  const trackedDays = summaries.length;

  return {
    goalMetDays,
    trackedDays,
    goalRate: trackedDays ? (goalMetDays / trackedDays) * 100 : 0
  };
}

function clamp(value: number, low: number, high: number) {
  return Math.min(Math.max(value, low), high);
}
