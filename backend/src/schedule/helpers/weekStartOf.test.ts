import { describe, it, expect } from "vitest";
import { weekStartOf } from "./weekStartOf.js";

describe("weekStartOf", () => {
  it.each([
    ["2026-10-05", "2026-10-05"], // Monday
    ["2026-10-06", "2026-10-05"],
    ["2026-10-07", "2026-10-05"],
    ["2026-10-08", "2026-10-05"],
    ["2026-10-09", "2026-10-05"],
    ["2026-10-10", "2026-10-05"],
    ["2026-10-11", "2026-10-05"], // Sunday
    ["2026-11-01", "2026-10-26"], // week starts in the month before
    ["2027-01-01", "2026-12-28"], // week starts in the year before
  ])("%s is in the week of %s", (date, monday) => {
    expect(weekStartOf(date)).toBe(monday);
  });
});
