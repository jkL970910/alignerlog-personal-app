import { describe, expect, it } from "vitest";

import { calculateDailySummary, calculateHistoryMetrics, splitSessionByDay } from "./summaries";
import type { OffTraySession, TreatmentPlan } from "./types";

const treatmentPlan: Pick<TreatmentPlan, "dailyGoalMinutes" | "currentTrayNumber"> = {
  dailyGoalMinutes: 1320,
  currentTrayNumber: 4
};

function session(overrides: Partial<OffTraySession>): OffTraySession {
  return {
    id: "session-1",
    userId: "personal",
    startAt: "2026-05-31T23:50:00.000Z",
    endAt: "2026-06-01T00:20:00.000Z",
    reason: "meal",
    reminderAt: null,
    reminderStatus: "none",
    createdAt: "2026-05-31T23:50:00.000Z",
    updatedAt: "2026-06-01T00:20:00.000Z",
    ...overrides
  };
}

describe("splitSessionByDay", () => {
  it("splits sessions across midnight", () => {
    const parts = splitSessionByDay(session({}), new Date("2026-06-01T00:20:00.000Z"));

    expect(parts).toEqual([
      { date: "2026-05-31", minutes: 10 },
      { date: "2026-06-01", minutes: 20 }
    ]);
  });

  it("uses now for active sessions", () => {
    const parts = splitSessionByDay(
      session({
        startAt: "2026-06-01T12:00:00.000Z",
        endAt: null
      }),
      new Date("2026-06-01T12:45:00.000Z")
    );

    expect(parts).toEqual([{ date: "2026-06-01", minutes: 45 }]);
  });

  it("splits by the user's local day instead of UTC midnight", () => {
    const parts = splitSessionByDay(
      session({
        startAt: "2026-06-04T02:30:00.000Z",
        endAt: "2026-06-04T03:30:00.000Z"
      }),
      new Date("2026-06-04T03:30:00.000Z"),
      "America/Toronto"
    );

    expect(parts).toEqual([{ date: "2026-06-03", minutes: 60 }]);
  });
});

describe("calculateHistoryMetrics", () => {
  it("excludes the in-progress current day from complete-day metrics", () => {
    const metrics = calculateHistoryMetrics([
      {
        date: "2026-06-04",
        offMinutes: 60,
        wearMinutes: 1380,
        goalMinutes: 1320,
        trayNumber: 1,
        sessionCount: 1,
        longestOffSessionMinutes: 60,
        goalMet: true,
        hasData: true
      },
      {
        date: "2026-06-05",
        offMinutes: 30,
        wearMinutes: 800,
        goalMinutes: 1320,
        trayNumber: 1,
        sessionCount: 1,
        longestOffSessionMinutes: 30,
        goalMet: false,
        hasData: true
      }
    ], { today: "2026-06-05" });

    expect(metrics.goalAchievementRate).toBe(100);
    expect(metrics.longestGoalStreak).toBe(1);
    expect(metrics.currentGoalStreak).toBe(1);
    expect(metrics.sevenDayAverage).toBe(1380);
    expect(metrics.monthlyGoalStats).toMatchObject({
      month: "2026-06",
      goalMetDays: 1,
      trackedDays: 1,
      recordedDays: 1,
      elapsedDays: 1,
      recordedGoalRate: 100,
      calendarGoalRate: 100
    });
  });

  it("tracks the current goal streak from the latest completed days", () => {
    const metrics = calculateHistoryMetrics([
      createSummary({ date: "2026-06-01", goalMet: true }),
      createSummary({ date: "2026-06-02", goalMet: false }),
      createSummary({ date: "2026-06-03", goalMet: true }),
      createSummary({ date: "2026-06-04", goalMet: true }),
      createSummary({ date: "2026-06-05", goalMet: true })
    ], { today: "2026-06-06" });

    expect(metrics.currentGoalStreak).toBe(3);
    expect(metrics.longestGoalStreak).toBe(3);
  });

  it("breaks the current goal streak when the latest completed day misses the goal", () => {
    const metrics = calculateHistoryMetrics([
      createSummary({ date: "2026-06-01", goalMet: true }),
      createSummary({ date: "2026-06-02", goalMet: true }),
      createSummary({ date: "2026-06-03", goalMet: false }),
      createSummary({ date: "2026-06-04", goalMet: true }),
      createSummary({ date: "2026-06-05", goalMet: false })
    ], { today: "2026-06-06" });

    expect(metrics.currentGoalStreak).toBe(0);
    expect(metrics.longestGoalStreak).toBe(2);
  });

  it("calculates monthly goal stats from tracked completed days in the current month only", () => {
    const metrics = calculateHistoryMetrics([
      createSummary({ date: "2026-05-31", goalMet: true }),
      createSummary({ date: "2026-06-01", goalMet: true }),
      createSummary({ date: "2026-06-02", goalMet: false }),
      createSummary({ date: "2026-06-03", goalMet: true }),
      createSummary({ date: "2026-06-05", goalMet: false, hasData: false })
    ], { today: "2026-06-06" });

    expect(metrics.monthlyGoalStats).toMatchObject({
      month: "2026-06",
      goalMetDays: 2,
      trackedDays: 3,
      recordedDays: 3,
      elapsedDays: 3,
      recordedGoalRate: (2 / 3) * 100,
      calendarGoalRate: (2 / 3) * 100
    });
    expect(metrics.overallGoalStats).toMatchObject({
      goalMetDays: 3,
      trackedDays: 4,
      goalRate: 75
    });
  });

  it("does not count pre-tracking plan dates as missed but includes manually backfilled sessions", () => {
    const metrics = calculateHistoryMetrics([
      createSummary({ date: "2026-06-01", goalMet: false, hasData: false }),
      createSummary({ date: "2026-06-02", goalMet: true, hasData: true }),
      createSummary({ date: "2026-06-03", goalMet: false, hasData: false }),
      createSummary({ date: "2026-06-04", goalMet: true }),
      createSummary({ date: "2026-06-05", goalMet: false })
    ], { today: "2026-06-06" });

    expect(metrics.monthlyGoalStats).toMatchObject({
      goalMetDays: 2,
      trackedDays: 3,
      recordedGoalRate: (2 / 3) * 100
    });
  });
});

describe("calculateDailySummary", () => {
  it("calculates current-day wear minutes from elapsed day minus off time", () => {
    const summary = calculateDailySummary({
      date: "2026-06-01",
      sessions: [
        session({
          startAt: "2026-06-01T10:00:00.000Z",
          endAt: "2026-06-01T11:30:00.000Z"
        })
      ],
      treatmentPlan,
      now: new Date("2026-06-01T12:00:00.000Z")
    });

    expect(summary.offMinutes).toBe(90);
    expect(summary.wearMinutes).toBe(630);
    expect(summary.hasData).toBe(true);
    expect(summary.goalMet).toBe(false);
  });

  it("counts a completed goal day", () => {
    const summary = calculateDailySummary({
      date: "2026-05-31",
      sessions: [
        session({
          startAt: "2026-05-31T12:00:00.000Z",
          endAt: "2026-05-31T13:00:00.000Z"
        })
      ],
      treatmentPlan,
      now: new Date("2026-06-01T12:00:00.000Z")
    });

    expect(summary.wearMinutes).toBe(1380);
    expect(summary.hasData).toBe(true);
    expect(summary.goalMet).toBe(true);
  });

  it("does not invent wear minutes for days without records", () => {
    const summary = calculateDailySummary({
      date: "2026-06-01",
      sessions: [],
      treatmentPlan,
      now: new Date("2026-06-01T12:00:00.000Z")
    });

    expect(summary.hasData).toBe(false);
    expect(summary.wearMinutes).toBe(0);
    expect(summary.goalMet).toBe(false);
  });

  it("can continue current-day wearing progress after tracking has started", () => {
    const summary = calculateDailySummary({
      date: "2026-06-01",
      sessions: [],
      treatmentPlan,
      now: new Date("2026-06-01T12:00:00.000Z"),
      hasTrackingStarted: true
    });

    expect(summary.hasData).toBe(true);
    expect(summary.wearMinutes).toBe(720);
  });

  it("does not backfill wear before the first tracking action on the first day", () => {
    const summary = calculateDailySummary({
      date: "2026-06-04",
      sessions: [
        session({
          startAt: "2026-06-05T03:28:26.000Z",
          endAt: "2026-06-05T03:28:27.000Z"
        })
      ],
      treatmentPlan,
      now: new Date("2026-06-05T03:30:00.000Z"),
      timeZone: "America/Toronto",
      hasTrackingStarted: true,
      trackingStartedAt: "2026-06-05T03:28:26.000Z"
    });

    expect(summary.hasData).toBe(true);
    expect(summary.wearMinutes).toBe(1);
    expect(summary.goalMet).toBe(false);
  });

  it("uses the local day elapsed time for current-day wear", () => {
    const summary = calculateDailySummary({
      date: "2026-06-03",
      sessions: [
        session({
          startAt: "2026-06-04T02:30:00.000Z",
          endAt: "2026-06-04T03:30:00.000Z"
        })
      ],
      treatmentPlan,
      now: new Date("2026-06-04T03:30:00.000Z"),
      timeZone: "America/Toronto"
    });

    expect(summary.offMinutes).toBe(60);
    expect(summary.wearMinutes).toBe(1350);
    expect(summary.hasData).toBe(true);
  });
});

function createSummary(overrides: Partial<Parameters<typeof calculateHistoryMetrics>[0][number]>): Parameters<typeof calculateHistoryMetrics>[0][number] {
  return {
    date: "2026-06-01",
    offMinutes: 60,
    wearMinutes: 1380,
    goalMinutes: 1320,
    trayNumber: 1,
    sessionCount: 1,
    longestOffSessionMinutes: 60,
    goalMet: true,
    hasData: true,
    ...overrides
  };
}
