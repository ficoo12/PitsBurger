import { describe, expect, it } from "vitest";
import { changes, dateTime, dayMonth, isoWeek, times, weekdayTime, weekRange } from "./format";

describe("format", () => {
  it("formats a day, a week and its number", () => {
    expect(dayMonth("2026-11-30")).toBe("30 Nov");
    expect(weekRange("2026-11-30")).toBe("30 Nov – 6 Dec 2026");
    expect(weekRange("2026-12-28")).toBe("28 Dec – 3 Jan 2027");
  });

  it.each([
    ["2026-11-30", 49],
    ["2025-12-29", 1], // its Thursday is in 2026
    ["2026-12-28", 53],
    ["2027-01-04", 1],
  ])("week starting %s is week %i", (weekStart, week) => {
    expect(isoWeek(weekStart)).toBe(week);
  });

  it("names moments of the window", () => {
    expect(weekdayTime(7, "23:59")).toBe("Sunday, 23:59");
    expect(dateTime("2026-12-04", "00:00")).toBe("Friday, 4 Dec, 00:00");
  });

  it("counts changes", () => {
    expect(changes(1)).toBe("1 change");
    expect(changes(2)).toBe("2 changes");
    expect([1, 2, 4].map(times)).toEqual(["once", "twice", "4 times"]);
  });
});
