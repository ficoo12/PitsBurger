import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addWeeks,
  isoWeekNumber,
  isWeekStart,
  thisWeekStart,
  weekDays,
  weekLabel,
  weekStartOf,
} from "./week";

afterEach(() => {
  vi.useRealTimers();
});

describe("weekStartOf", () => {
  it("returns the Monday of the date's week", () => {
    expect(weekStartOf("2026-11-16")).toBe("2026-11-16"); // Monday
    expect(weekStartOf("2026-11-19")).toBe("2026-11-16"); // Thursday
    expect(weekStartOf("2026-11-22")).toBe("2026-11-16"); // Sunday
    expect(weekStartOf("2027-01-01")).toBe("2026-12-28"); // across the new year
  });
});

describe("addWeeks", () => {
  it("moves whole weeks forward and back, across months and daylight saving", () => {
    expect(addWeeks("2026-11-16", 1)).toBe("2026-11-23");
    expect(addWeeks("2026-11-30", -1)).toBe("2026-11-23");
    expect(addWeeks("2026-03-23", 1)).toBe("2026-03-30"); // clocks go forward on 29.03.
    expect(addWeeks("2026-12-28", 1)).toBe("2027-01-04");
  });
});

describe("thisWeekStart", () => {
  it("is the Monday of today's week by the local clock", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 22, 23, 30)); // Sunday night

    expect(thisWeekStart()).toBe("2026-11-16");
  });
});

describe("isWeekStart", () => {
  it("accepts only real Mondays as YYYY-MM-DD", () => {
    expect(isWeekStart("2026-11-16")).toBe(true);
    expect(isWeekStart("2026-11-17")).toBe(false); // Tuesday
    expect(isWeekStart("2026-02-30")).toBe(false); // no such day
    expect(isWeekStart("2026-11-16x")).toBe(false);
    expect(isWeekStart("")).toBe(false);
  });
});

describe("weekDays", () => {
  it("lists Monday to Sunday with their ISO weekday and a short label", () => {
    const days = weekDays("2026-11-16");

    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ date: "2026-11-16", weekday: 1, name: "Monday", label: "16.11." });
    expect(days[6]).toEqual({ date: "2026-11-22", weekday: 7, name: "Sunday", label: "22.11." });
  });
});

describe("isoWeekNumber", () => {
  it("counts weeks the ISO 8601 way", () => {
    expect(isoWeekNumber("2026-11-16")).toBe(47);
    expect(isoWeekNumber("2025-12-29")).toBe(1); // its Thursday is in 2026
    expect(isoWeekNumber("2026-12-28")).toBe(53);
  });
});

describe("weekLabel", () => {
  it("shows the dates and the week number", () => {
    expect(weekLabel("2026-11-16")).toBe("16.11. – 22.11.2026 · Week 47");
  });

  it("names both years when the week runs into the next one", () => {
    expect(weekLabel("2025-12-29")).toBe("29.12.2025 – 04.01.2026 · Week 1");
  });
});
