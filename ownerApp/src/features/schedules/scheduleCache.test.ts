import { describe, expect, it } from "vitest";
import { dropEntry, dropHint, putEntry } from "./scheduleCache";
import type { Schedule, ScheduleEntry } from "./types";

function entry(id: number, workDate: string, fields: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return { id, employeeId: 7, workDate, shiftId: 1, startTime: null, endTime: null, note: null, ...fields };
}

const week: Schedule = {
  restaurantId: 1,
  weekStart: "2026-11-16",
  entries: [entry(4, "2026-11-16"), entry(2, "2026-11-18"), entry(5, "2026-11-18")],
  availability: [
    {
      employeeId: 7,
      note: "Car 181",
      days: [
        { date: "2026-11-16", shiftId: 1 },
        { date: "2026-11-17", shiftId: 2 },
      ],
    },
    { employeeId: 8, note: null, days: [{ date: "2026-11-16", shiftId: 1 }] },
  ],
};

describe("putEntry", () => {
  it("adds a new cell in day order, then id order", () => {
    const next = putEntry(week, entry(3, "2026-11-18"));

    expect(next.entries.map((item) => item.id)).toEqual([4, 2, 3, 5]);
    expect(next.restaurantId).toBe(1);
    expect(week.entries).toHaveLength(3); // the cached week isn't changed in place
  });

  it("replaces the cell with the same id", () => {
    const next = putEntry(week, entry(2, "2026-11-18", { shiftId: 2, note: "181" }));

    expect(next.entries).toHaveLength(3);
    expect(next.entries[1]).toMatchObject({ id: 2, shiftId: 2, note: "181" });
  });
});

describe("dropEntry", () => {
  it("removes the cell with the id", () => {
    expect(dropEntry(week, 2).entries.map((item) => item.id)).toEqual([4, 5]);
  });

  it("leaves the week alone when there is no such cell", () => {
    expect(dropEntry(week, 99).entries).toEqual(week.entries);
  });
});

describe("dropHint", () => {
  it("drops only that person's hint on that day and keeps their note", () => {
    const next = dropHint(week, 7, "2026-11-16");

    expect(next.availability).toEqual([
      { employeeId: 7, note: "Car 181", days: [{ date: "2026-11-17", shiftId: 2 }] },
      { employeeId: 8, note: null, days: [{ date: "2026-11-16", shiftId: 1 }] },
    ]);
    expect(next.entries).toBe(week.entries);
    expect(week.availability[0]?.days).toHaveLength(2); // the cached week isn't changed in place
  });
});
