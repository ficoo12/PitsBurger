import { describe, expect, it } from "vitest";
import { testEmployee } from "../../../test/fixtures";
import type { Employee } from "../../employees";
import type { Position } from "../../positions";
import type { Restaurant } from "../../restaurants";
import type { ScheduleEntry } from "../types";
import { pdfFilename, schedulePdfPages } from "./schedulePdfModel";

const WEEK = "2026-11-16";
const stamp = "2026-11-11T22:00:00.000Z";
// Closed on Mondays.
const riverside: Restaurant = {
  id: 1,
  name: "Riverside",
  colour: "teal",
  createdAt: stamp,
  updatedAt: stamp,
  openingHours: [2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    openTime: "11:00",
    closeTime: "23:00",
  })),
  shiftTimes: [
    { shiftId: 1, name: "Früh", startTime: "08:00", endTime: "16:00", shade: "early", ownTimes: false },
    { shiftId: 2, name: "Spät", startTime: "16:00", endTime: "00:00", shade: "late", ownTimes: false },
    { shiftId: 3, name: "Inventur", startTime: "06:00", endTime: "08:00", shade: "full", ownTimes: false },
  ],
};
const harbour: Restaurant = { ...riverside, id: 2, name: "Harbour", colour: "green" };

const service: Position = { id: 1, name: "Service", colour: "red" };
const kitchen: Position = { id: 2, name: "Küche", colour: "yellow" };
const positions = [service, kitchen];

function person(id: number, firstName: string, own: Position[]): Employee {
  return { ...testEmployee, id, userId: id * 10, firstName, lastName: "Test", positions: own };
}

function entry(fields: Partial<ScheduleEntry> & Pick<ScheduleEntry, "employeeId">): ScheduleEntry {
  return {
    id: 1,
    workDate: "2026-11-17",
    shiftId: 2,
    startTime: null,
    endTime: null,
    note: null,
    ...fields,
  };
}

const waiter = person(1, "Ana", [service]);
const cook = person(2, "Bilal", [kitchen]);
// Their position was deleted, so no zone fits: they come last.
const cleaner = person(3, "Cem", [{ id: 9, name: "Cleaning", colour: "brown" }]);

describe("schedulePdfPages", () => {
  it("makes one page per restaurant with a shift and skips the others", () => {
    const pages = schedulePdfPages(
      [
        { restaurant: riverside, employees: [waiter], entries: [] },
        { restaurant: harbour, employees: [waiter], entries: [entry({ employeeId: waiter.id })] },
      ],
      positions,
      WEEK,
    );

    expect(pages.map((page) => page.restaurantName)).toEqual(["Harbour"]);
    expect(pages[0]!.colour).toBe("green");
  });

  it("has no pages when nothing is planned", () => {
    expect(
      schedulePdfPages(
        [{ restaurant: riverside, employees: [waiter, cook], entries: [] }],
        positions,
        WEEK,
      ),
    ).toEqual([]);
  });

  it("lists only people with a shift, in the screen's order, without position headings", () => {
    const [page] = schedulePdfPages(
      [
        {
          restaurant: riverside,
          employees: [cleaner, cook, waiter, person(4, "Dana", [service])],
          entries: [
            entry({ employeeId: cook.id }),
            entry({ id: 2, employeeId: cleaner.id }),
            entry({ id: 3, employeeId: waiter.id }),
          ],
        },
      ],
      positions,
      WEEK,
    );

    // Service, then Küche (the order they were created), then the rest; Dana has no shift.
    expect(page!.rows.map((row) => row.name)).toEqual(["Ana Test", "Bilal Test", "Cem Test"]);
  });

  it("names the seven days and marks the closed ones", () => {
    const [page] = schedulePdfPages(
      [{ restaurant: riverside, employees: [waiter], entries: [entry({ employeeId: waiter.id })] }],
      positions,
      WEEK,
    );

    expect(page!.days).toHaveLength(7);
    expect(page!.days[0]).toEqual({ name: "Monday", label: "16.11.", closed: true });
    expect(page!.days[1]).toEqual({ name: "Tuesday", label: "17.11.", closed: false });
  });

  it("gives a cell the screen's text and what colours it", () => {
    const [page] = schedulePdfPages(
      [
        {
          restaurant: riverside,
          employees: [waiter],
          entries: [
            entry({ employeeId: waiter.id, startTime: "18:00", note: "336" }),
            entry({ id: 2, employeeId: waiter.id, workDate: "2026-11-18", shiftId: 3 }),
          ],
        },
      ],
      positions,
      WEEK,
    );
    const cells = page!.rows[0]!.cells;

    // Monday: closed, no shift. Tuesday: Spät. Wednesday: Inventur. Thursday: free.
    // A shift is coloured by the zone's colour and its own shade, whatever its name.
    expect(cells.slice(0, 4)).toEqual([
      { text: "", colour: null, shade: "closed" },
      { text: "Spät ab 18:00 | 336", colour: "red", shade: "late" },
      { text: "Inventur", colour: "red", shade: "full" },
      { text: "", colour: null, shade: "none" },
    ]);
  });
});

describe("pdfFilename", () => {
  it("names the file after the ISO week", () => {
    expect(pdfFilename("2026-11-16")).toBe("schedule-2026-W47.pdf");
    expect(pdfFilename("2026-02-02")).toBe("schedule-2026-W06.pdf");
  });

  it("uses the year the week belongs to", () => {
    // 29.12.2025 – 04.01.2026 is week 1 of 2026.
    expect(pdfFilename("2025-12-29")).toBe("schedule-2026-W01.pdf");
  });
});
