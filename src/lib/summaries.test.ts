import { describe, expect, it } from "vitest";

import { calculateDailySummary, splitSessionByDay } from "./summaries";
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
