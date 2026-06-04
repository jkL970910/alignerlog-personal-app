import { describe, expect, it } from "vitest";

import { dayBounds, elapsedMinutesInDay, minutesInDay, todayKey } from "./dates";

describe("timezone-aware date helpers", () => {
  it("derives today from the requested timezone", () => {
    const now = new Date("2026-06-04T02:30:00Z");

    expect(todayKey(now, "UTC")).toBe("2026-06-04");
    expect(todayKey(now, "America/Toronto")).toBe("2026-06-03");
  });

  it("uses local midnight bounds for Toronto days", () => {
    const bounds = dayBounds("2026-06-04", "America/Toronto");

    expect(bounds.start.toISOString()).toBe("2026-06-04T04:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-06-05T04:00:00.000Z");
    expect(minutesInDay("2026-06-04", "America/Toronto")).toBe(1440);
  });

  it("handles daylight saving day length", () => {
    expect(minutesInDay("2026-03-08", "America/Toronto")).toBe(1380);
    expect(minutesInDay("2026-11-01", "America/Toronto")).toBe(1500);
  });

  it("calculates elapsed minutes within the user's local day", () => {
    const elapsed = elapsedMinutesInDay(
      "2026-06-03",
      new Date("2026-06-04T02:30:00Z"),
      "America/Toronto"
    );

    expect(elapsed).toBe(1350);
  });
});
