import type { Shade } from "../../lib/palette";
import type { Employee } from "../employees";
import type { Position } from "../positions";
import type { ShiftTime } from "../restaurants";
import type { AddedRow } from "./addedRowsStore";
import type { AvailabilityHint, ScheduleEntry } from "./types";

/** One person's line in one zone of a restaurant's week. */
export type ScheduleRow = {
  employee: Employee;
  /** The zone the row is in: one of the owner's positions, or null for the rest. */
  position: Position | null;
  /**
   * The person's cells this week in this restaurant, by date ("YYYY-MM-DD").
   * A cell has no zone, so someone with rows in two zones shows them in both.
   */
  cells: Map<string, ScheduleEntry>;
  /**
   * The shift the person can work, by date ("YYYY-MM-DD"), from their
   * availability. A day with a cell keeps its hint here; the cell wins.
   */
  hints: Map<string, number>;
  /** The note of their availability for the week, or null. */
  note: string | null;
  /** True when only the owner's adding puts the row here: no saved shift or availability does. */
  added: boolean;
};

/** Whether someone's availability brings them onto the week: a day to show, or a note. */
export function hasAvailability(row: Pick<ScheduleRow, "hints" | "note">): boolean {
  return row.hints.size > 0 || row.note !== null;
}

/** One of the owner's positions with its rows; null is for people without a position. */
export type ScheduleZone = { position: Position | null; rows: ScheduleRow[] };

/** The person's first zone: the oldest of their positions that the owner still has. */
export function firstPosition(employee: Employee, positions: Position[]): Position | null {
  const own = new Set(employee.positions.map((position) => position.id));
  return byCreation(positions).find((position) => own.has(position.id)) ?? null;
}

/** Oldest first: the order the owner created them in (ids only grow). */
function byCreation(positions: Position[]): Position[] {
  return [...positions].sort((a, b) => a.id - b.id);
}

/**
 * The zones of a restaurant's week: one per position of the owner, in the
 * order they were created, always, even when empty. Only people on this week
 * are in them, so someone who works elsewhere this week isn't listed here.
 *
 * - Someone with a saved shift here, or availability (a day or a note), is
 *   in their first zone (firstPosition), in the order of the employee list.
 *   That includes people who have left and still have a shift.
 * - The rows the owner added follow, in the order they were added. Someone
 *   who is already in that zone isn't listed twice; a row for a position that
 *   was deleted since is left out.
 * - Someone with a shift but no position gets a last zone (position null),
 *   only when there is such a person.
 */
export function scheduleZones(
  positions: Position[],
  employees: Employee[],
  entries: ScheduleEntry[],
  added: AddedRow[],
  availability: AvailabilityHint[] = [],
): ScheduleZone[] {
  const cellsByEmployee = new Map<number, Map<string, ScheduleEntry>>();
  for (const entry of entries) {
    let cells = cellsByEmployee.get(entry.employeeId);
    if (!cells) {
      cells = new Map();
      cellsByEmployee.set(entry.employeeId, cells);
    }
    cells.set(entry.workDate, entry);
  }
  const cellsOf = (employee: Employee) =>
    cellsByEmployee.get(employee.id) ?? new Map<string, ScheduleEntry>();

  const availabilityByEmployee = new Map(availability.map((hint) => [hint.employeeId, hint]));
  /** A new row's cells, hints and note: shared by all rows of one person. */
  const contentOf = (employee: Employee) => {
    const hint = availabilityByEmployee.get(employee.id);
    return {
      cells: cellsOf(employee),
      hints: new Map(hint?.days.map((day) => [day.date, day.shiftId])),
      note: hint?.note ?? null,
    };
  };

  const zones: ScheduleZone[] = byCreation(positions).map((position) => ({ position, rows: [] }));
  const other: ScheduleZone = { position: null, rows: [] };
  const zoneOf = (position: Position | null) =>
    position === null ? other : zones.find((zone) => zone.position?.id === position.id)!;

  for (const employee of employees) {
    const content = contentOf(employee);
    if (!cellsByEmployee.has(employee.id) && !hasAvailability(content)) continue;
    const position = firstPosition(employee, positions);
    zoneOf(position).rows.push({ employee, position, ...content, added: false });
  }

  const byId = new Map(employees.map((employee) => [employee.id, employee]));
  for (const { employeeId, positionId } of added) {
    const employee = byId.get(employeeId);
    const zone = zones.find((item) => item.position?.id === positionId);
    // Gone from the restaurant, a deleted position, or already there because
    // of a saved shift.
    if (!employee || !zone || zone.rows.some((row) => row.employee.id === employeeId)) continue;
    zone.rows.push({ employee, position: zone.position, ...contentOf(employee), added: true });
  }

  return other.rows.length > 0 ? [...zones, other] : zones;
}

/**
 * What a cell says, like the Excel plans: the shift's name, "ab" / "bis" when
 * this day starts or ends at another time, and the note after a bar:
 * "Spät ab 18:00 | 336".
 */
export function shiftLabel(entry: ScheduleEntry, shift: ShiftTime | undefined): string {
  const parts = [shift?.name ?? "Unknown shift"];
  if (entry.startTime) parts.push(`ab ${entry.startTime}`);
  if (entry.endTime) parts.push(`bis ${entry.endTime}`);
  if (entry.note) parts.push(`| ${entry.note}`);
  return parts.join(" ");
}

/** The cell's actual times, "18:00–00:00", or null when its shift is unknown. */
export function shiftTimes(entry: ScheduleEntry, shift: ShiftTime | undefined): string | null {
  const start = entry.startTime ?? shift?.startTime;
  const end = entry.endTime ?? shift?.endTime;
  return start && end ? `${start}–${end}` : null;
}

/**
 * What colours a day's cell: the shift's shade, "other" for a shift the
 * restaurant doesn't have (yet) in the cache, and without a shift "closed" on
 * a closed day, else "none".
 */
export type CellShade = Shade | "other" | "closed" | "none";

/** The shade of one day's cell, on screen and in the PDF. */
export function cellShade(
  entry: ScheduleEntry | undefined,
  shift: ShiftTime | undefined,
  closed: boolean,
): CellShade {
  if (entry) return shift?.shade ?? "other";
  return closed ? "closed" : "none";
}
