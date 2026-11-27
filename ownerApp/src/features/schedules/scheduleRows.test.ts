import { describe, expect, it } from "vitest";
import { testEmployee } from "../../test/fixtures";
import type { Employee } from "../employees";
import type { Position } from "../positions";
import type { ShiftTime } from "../restaurants";
import {
  cellShade,
  firstPosition,
  hasAvailability,
  scheduleZones,
  shiftLabel,
  shiftTimes,
  type ScheduleZone,
} from "./scheduleRows";
import type { ScheduleEntry } from "./types";

const spaet: ShiftTime = { shiftId: 2, name: "Spät", startTime: "16:00", endTime: "00:00", shade: "late", ownTimes: false };

function person(id: number, positions: Position[], fields: Partial<Employee> = {}): Employee {
  return {
    ...testEmployee,
    id,
    userId: id * 10,
    positions,
    ...fields,
  };
}

function entry(fields: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    id: 1,
    employeeId: 1,
    workDate: "2026-11-16",
    shiftId: spaet.shiftId,
    startTime: null,
    endTime: null,
    note: null,
    ...fields,
  };
}

/** Each zone as its position's name and its rows' [employee id, added]. */
function shape(zones: ScheduleZone[]) {
  return zones.map((zone) => [
    zone.position?.name ?? null,
    zone.rows.map((row) => [row.employee.id, row.added]),
  ]);
}

// The owner's positions, in the order they were created (by id).
const service: Position = { id: 1, name: "Service", colour: "red" };
const kitchen: Position = { id: 2, name: "Kitchen", colour: "yellow" };
const driver: Position = { id: 3, name: "Driver", colour: "green" };
// Given out of order on purpose: the zones sort them by id themselves.
const positions = [driver, service, kitchen];

const waiter = person(1, [service]);
const cook = person(2, [kitchen]);
const rider = person(3, [driver]);
const both = person(4, [driver, service]);
// Their only position was deleted meanwhile, so no zone fits.
const cleaner = person(5, [{ id: 9, name: "Cleaning", colour: "brown" }]);

describe("firstPosition", () => {
  it("is the person's oldest position that the owner still has", () => {
    expect(firstPosition(both, positions)).toBe(service);
    expect(firstPosition(cleaner, positions)).toBeNull();
  });
});

describe("scheduleZones", () => {
  it("always has a zone per position, oldest first, empty when nobody is on the week", () => {
    expect(shape(scheduleZones(positions, [waiter, cook, rider], [], []))).toEqual([
      ["Service", []],
      ["Kitchen", []],
      ["Driver", []],
    ]);
  });

  it("orders zones by when the position was created, not by name", () => {
    const bar: Position = { id: 4, name: "Bar", colour: "purple" };

    expect(shape(scheduleZones([bar, ...positions], [], [], [])).map(([name]) => name)).toEqual([
      "Service",
      "Kitchen",
      "Driver",
      "Bar",
    ]);
  });

  it("gives every row its zone's position, with its colour", () => {
    const zones = scheduleZones(positions, [rider], [entry({ employeeId: rider.id })], []);

    expect(zones[2]?.rows[0]?.position).toEqual(driver);
  });

  it("puts people with a saved shift in their first zone, in list order, with their cells", () => {
    const monday = entry({ id: 1, employeeId: rider.id });
    const friday = entry({ id: 2, employeeId: rider.id, workDate: "2026-11-20" });
    const zones = scheduleZones(
      positions,
      [rider, both, cook, waiter],
      [monday, friday, entry({ id: 3, employeeId: both.id }), entry({ id: 4, employeeId: waiter.id })],
      [],
    );

    expect(shape(zones)).toEqual([
      ["Service", [[both.id, false], [waiter.id, false]]],
      ["Kitchen", []],
      ["Driver", [[rider.id, false]]],
    ]);
    expect(zones[2]?.rows[0]?.cells.get("2026-11-16")).toBe(monday);
    expect(zones[2]?.rows[0]?.cells.get("2026-11-20")).toBe(friday);
  });

  it("includes someone who has left while they still have a shift", () => {
    const left = person(6, [service], { status: "left" });

    expect(shape(scheduleZones(positions, [left], [entry({ employeeId: left.id })], []))[0]).toEqual(
      ["Service", [[left.id, false]]],
    );
  });

  it("puts added rows under the saved ones in the order added, without doubles", () => {
    const zones = scheduleZones(
      positions,
      [waiter, cook, both, rider],
      [entry({ employeeId: waiter.id })],
      [
        { employeeId: both.id, positionId: service.id },
        { employeeId: waiter.id, positionId: service.id }, // already there by a shift
        { employeeId: cook.id, positionId: kitchen.id },
        { employeeId: 99, positionId: kitchen.id }, // no longer in the restaurant
        { employeeId: rider.id, positionId: 9 }, // the position was deleted
      ],
    );

    expect(shape(zones)).toEqual([
      ["Service", [[waiter.id, false], [both.id, true]]],
      ["Kitchen", [[cook.id, true]]],
      ["Driver", []],
    ]);
  });

  it("shows a person in two zones with the same cells in both rows", () => {
    const shift = entry({ employeeId: both.id });
    const zones = scheduleZones(
      positions,
      [both],
      [shift],
      [{ employeeId: both.id, positionId: driver.id }],
    );

    expect(shape(zones)).toEqual([
      ["Service", [[both.id, false]]],
      ["Kitchen", []],
      ["Driver", [[both.id, true]]],
    ]);
    expect(zones[0]?.rows[0]?.cells.get("2026-11-16")).toBe(shift);
    expect(zones[2]?.rows[0]?.cells.get("2026-11-16")).toBe(shift);
    expect(zones[2]?.rows[0]?.position).toBe(driver);
  });

  it("puts people with availability in their first zone, with their hints and note", () => {
    const zones = scheduleZones(
      positions,
      [waiter, cook, rider],
      [entry({ employeeId: waiter.id })],
      [],
      [
        { employeeId: rider.id, note: "Car 181", days: [{ date: "2026-11-17", shiftId: 1 }] },
        // A note but no days: can't work this week, and the owner should read why.
        { employeeId: cook.id, note: "On holiday", days: [] },
        { employeeId: waiter.id, note: null, days: [{ date: "2026-11-16", shiftId: 2 }] },
      ],
    );

    expect(shape(zones)).toEqual([
      ["Service", [[waiter.id, false]]],
      ["Kitchen", [[cook.id, false]]],
      ["Driver", [[rider.id, false]]],
    ]);
    expect(zones[2]?.rows[0]?.hints).toEqual(new Map([["2026-11-17", 1]]));
    expect(zones[2]?.rows[0]?.note).toBe("Car 181");
    expect(zones[1]?.rows[0]?.hints.size).toBe(0);
    expect(zones[1]?.rows[0]?.note).toBe("On holiday");
    // A hint on a day with a saved shift is kept; the table shows the shift.
    expect(zones[0]?.rows[0]?.hints.get("2026-11-16")).toBe(2);
  });

  it("brings nobody onto the week whose availability has nothing left to show", () => {
    const zones = scheduleZones(positions, [waiter], [], [], [
      { employeeId: waiter.id, note: null, days: [] },
    ]);

    expect(shape(zones)[0]).toEqual(["Service", []]);
  });

  it("gives an added row of the same person the same hints and note", () => {
    const zones = scheduleZones(
      positions,
      [both],
      [],
      [{ employeeId: both.id, positionId: driver.id }],
      [{ employeeId: both.id, note: "K | F", days: [{ date: "2026-11-18", shiftId: 1 }] }],
    );

    expect(shape(zones)).toEqual([
      ["Service", [[both.id, false]]],
      ["Kitchen", []],
      ["Driver", [[both.id, true]]],
    ]);
    expect(zones[2]?.rows[0]?.hints.get("2026-11-18")).toBe(1);
    expect(zones[2]?.rows[0]?.note).toBe("K | F");
  });

  it("adds a last zone for people with a shift but none of the owner's positions", () => {
    const zones = scheduleZones(positions, [cleaner], [entry({ employeeId: cleaner.id })], []);

    expect(shape(zones)).toEqual([
      ["Service", []],
      ["Kitchen", []],
      ["Driver", []],
      [null, [[cleaner.id, false]]],
    ]);
    expect(zones[3]?.rows[0]?.position).toBeNull();
  });
});

describe("cellShade", () => {
  it("is the shift's shade, or other for a shift the restaurant doesn't know", () => {
    expect(cellShade(entry(), spaet, false)).toBe("late");
    expect(cellShade(entry(), undefined, false)).toBe("other");
  });

  it("is closed or none for a day without a shift", () => {
    expect(cellShade(undefined, undefined, true)).toBe("closed");
    expect(cellShade(undefined, undefined, false)).toBe("none");
  });
});

describe("shiftLabel", () => {
  it("is the shift's name when the cell keeps its times and has no note", () => {
    expect(shiftLabel(entry(), spaet)).toBe("Spät");
  });

  it("adds ab / bis for a changed start or end", () => {
    expect(shiftLabel(entry({ startTime: "18:00" }), spaet)).toBe("Spät ab 18:00");
    expect(shiftLabel(entry({ endTime: "22:00" }), spaet)).toBe("Spät bis 22:00");
    expect(shiftLabel(entry({ startTime: "18:00", endTime: "22:00" }), spaet)).toBe(
      "Spät ab 18:00 bis 22:00",
    );
  });

  it("puts the note after a bar, like the Excel plans", () => {
    expect(shiftLabel(entry({ note: "336" }), spaet)).toBe("Spät | 336");
    expect(shiftLabel(entry({ startTime: "18:00", note: "336" }), spaet)).toBe(
      "Spät ab 18:00 | 336",
    );
  });

  it("says so when the shift isn't known", () => {
    expect(shiftLabel(entry(), undefined)).toBe("Unknown shift");
  });
});

describe("shiftTimes", () => {
  it("is the shift's times with the cell's own start or end in their place", () => {
    expect(shiftTimes(entry(), spaet)).toBe("16:00–00:00");
    expect(shiftTimes(entry({ startTime: "18:00" }), spaet)).toBe("18:00–00:00");
    expect(shiftTimes(entry(), undefined)).toBeNull();
  });
});

describe("hasAvailability", () => {
  it("is true with a day to show or a note", () => {
    expect(hasAvailability({ hints: new Map([["2026-11-16", 1]]), note: null })).toBe(true);
    expect(hasAvailability({ hints: new Map(), note: "On holiday" })).toBe(true);
    expect(hasAvailability({ hints: new Map(), note: null })).toBe(false);
  });
});
