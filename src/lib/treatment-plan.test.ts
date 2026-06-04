import { describe, expect, it } from "vitest";

import { buildTreatmentPlanImportPreview } from "./treatment-plan";

describe("buildTreatmentPlanImportPreview", () => {
  it("builds a schedule for an already-started active series", () => {
    const preview = buildTreatmentPlanImportPreview({
      status: "active",
      seriesType: "active",
      name: "第一阶段",
      currentTrayNumber: 3,
      totalTrays: 5,
      overallTotalTrays: 12,
      overallTreatmentDays: 84,
      trayIntervalDays: 7,
      dailyGoalMinutes: 1320,
      currentTrayStartDate: "2026-06-01"
    }, new Date("2026-06-04T12:00:00Z"));

    expect(preview.series.startDate).toBe("2026-05-18");
    expect(preview.series.nextChangeDate).toBe("2026-06-08");
    expect(preview.series.overallTotalTrays).toBe(12);
    expect(preview.progress.overallTreatmentDays).toBe(84);
    expect(preview.progress.currentTrayDay).toBe(4);
    expect(preview.progress.traysRemaining).toBe(2);
    expect(preview.trays.map((tray) => tray.status)).toEqual([
      "completed",
      "completed",
      "current",
      "upcoming",
      "upcoming"
    ]);
  });

  it("can infer current tray start from next change date", () => {
    const preview = buildTreatmentPlanImportPreview({
      status: "active",
      seriesType: "active",
      name: "第一阶段",
      currentTrayNumber: 8,
      totalTrays: 20,
      trayIntervalDays: 10,
      dailyGoalMinutes: 1320,
      nextChangeDate: "2026-06-10"
    }, new Date("2026-06-04T12:00:00Z"));

    expect(preview.series.currentTrayStartDate).toBe("2026-06-01");
    expect(preview.progress.daysUntilNextChange).toBe(6);
    expect(preview.progress.overallTotalTrays).toBe(20);
  });

  it("pauses change countdown for holding status", () => {
    const preview = buildTreatmentPlanImportPreview({
      status: "holding",
      seriesType: "holding",
      name: "等待精修",
      currentTrayNumber: 20,
      totalTrays: 20,
      trayIntervalDays: 14,
      dailyGoalMinutes: 1320,
      currentTrayStartDate: "2026-05-25"
    }, new Date("2026-06-04T12:00:00Z"));

    expect(preview.progress.label).toBe("holding");
    expect(preview.progress.nextChangeDate).toBeNull();
    expect(preview.trays.at(-1)?.status).toBe("paused");
  });
});
