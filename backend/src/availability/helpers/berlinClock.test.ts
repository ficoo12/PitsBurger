import { describe, it, expect } from "vitest";
import {
  addDays,
  berlinNow,
  isWindowOpen,
  nextOpening,
  nextWeekStart,
  shownWeekStart,
} from "./berlinClock.js";

describe("berlinNow", () => {
  it.each([
    // Winter time: UTC+1.
    ["2026-11-27T11:00:00Z", { date: "2026-11-27", weekday: 5, time: "12:00" }],
    // Summer time: UTC+2.
    ["2026-07-03T11:00:00Z", { date: "2026-07-03", weekday: 5, time: "13:00" }],
    // Sunday evening in UTC is already Monday in Berlin.
    ["2026-11-29T23:30:00Z", { date: "2026-11-30", weekday: 1, time: "00:30" }],
    ["2026-11-29T22:59:00Z", { date: "2026-11-29", weekday: 7, time: "23:59" }],
    // The night summer time ends: 01:30 UTC is 02:30 winter time.
    ["2026-10-25T01:30:00Z", { date: "2026-10-25", weekday: 7, time: "02:30" }],
  ])("%s is %o in Berlin", (iso, expected) => {
    expect(berlinNow(new Date(iso))).toEqual(expected);
  });
});

describe("addDays", () => {
  it("goes forward and back across months and years", () => {
    expect(addDays("2026-11-27", 7)).toBe("2026-12-04");
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
    expect(addDays("2026-11-27", -20)).toBe("2026-11-07");
  });
});

describe("nextWeekStart", () => {
  it.each([
    ["2026-11-23", "2026-11-30"], // Monday
    ["2026-11-27", "2026-11-30"], // Friday
    ["2026-11-29", "2026-11-30"], // Sunday
    ["2026-12-30", "2027-01-04"], // into the next year
  ])("the week after %s starts on %s", (date, monday) => {
    expect(nextWeekStart(date)).toBe(monday);
  });
});

describe("isWindowOpen", () => {
  // The defaults: Friday 00:00 to Sunday 23:59.
  const defaults = {
    opensWeekday: 5,
    opensTime: "00:00",
    closesWeekday: 7,
    closesTime: "23:59",
  };

  it.each([
    [4, "23:59", false], // the minute before it opens
    [5, "00:00", true], // the opening minute
    [6, "12:00", true],
    [7, "23:59", true], // the closing minute still counts
    [1, "00:00", false], // the next week has started
  ])("weekday %i at %s → %s", (weekday, time, open) => {
    expect(isWindowOpen(defaults, { weekday, time })).toBe(open);
  });

  it("handles a window on one day", () => {
    const friday = {
      opensWeekday: 5,
      opensTime: "10:00",
      closesWeekday: 5,
      closesTime: "18:00",
    };

    expect(isWindowOpen(friday, { weekday: 5, time: "09:59" })).toBe(false);
    expect(isWindowOpen(friday, { weekday: 5, time: "10:00" })).toBe(true);
    expect(isWindowOpen(friday, { weekday: 5, time: "18:00" })).toBe(true);
    expect(isWindowOpen(friday, { weekday: 5, time: "18:01" })).toBe(false);
    expect(isWindowOpen(friday, { weekday: 6, time: "12:00" })).toBe(false);
  });
});

describe("shownWeekStart and nextOpening", () => {
  // The defaults: Friday 00:00 to Sunday 23:59.
  const defaults = {
    opensWeekday: 5,
    opensTime: "00:00",
    closesWeekday: 7,
    closesTime: "23:59",
  };
  // Wednesday 08:30 to Thursday 20:00: closes in the middle of the week.
  const midWeek = {
    opensWeekday: 3,
    opensTime: "08:30",
    closesWeekday: 4,
    closesTime: "20:00",
  };

  it.each([
    // Monday 2026-11-30, before this week's opening: this week, opens Friday.
    ["Monday 00:00", defaults, { date: "2026-11-30", weekday: 1, time: "00:00" }, "2026-11-30", { date: "2026-12-04", time: "00:00" }],
    ["Thursday 23:59", defaults, { date: "2026-12-03", weekday: 4, time: "23:59" }, "2026-11-30", { date: "2026-12-04", time: "00:00" }],
    // From the opening minute on: next week, open.
    ["Friday 00:00", defaults, { date: "2026-12-04", weekday: 5, time: "00:00" }, "2026-12-07", null],
    ["Sunday 23:59", defaults, { date: "2026-12-06", weekday: 7, time: "23:59" }, "2026-12-07", null],
    // Before a mid-week window: this week, opens on Wednesday.
    ["Tuesday before a mid-week window", midWeek, { date: "2026-12-01", weekday: 2, time: "12:00" }, "2026-11-30", { date: "2026-12-02", time: "08:30" }],
    // After it closed: still next week, opens next Wednesday.
    ["Thursday 20:01 after a mid-week window", midWeek, { date: "2026-12-03", weekday: 4, time: "20:01" }, "2026-12-07", { date: "2026-12-09", time: "08:30" }],
    ["Sunday after a mid-week window", midWeek, { date: "2026-12-06", weekday: 7, time: "12:00" }, "2026-12-07", { date: "2026-12-09", time: "08:30" }],
  ])("%s → week %s", (_label, window, now, week, opening) => {
    expect(shownWeekStart(window, now)).toBe(week);
    expect(nextOpening(window, now)).toEqual(opening);
  });
});
