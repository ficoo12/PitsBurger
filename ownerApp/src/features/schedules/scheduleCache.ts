import type { Schedule, ScheduleEntry } from "./types";

/**
 * The week with `entry` added, or put in place of the cell with its id. The
 * entries stay sorted like the API sends them: by day, then by id.
 */
export function putEntry(schedule: Schedule, entry: ScheduleEntry): Schedule {
  const entries = [...schedule.entries.filter((item) => item.id !== entry.id), entry].sort(
    (a, b) => a.workDate.localeCompare(b.workDate) || a.id - b.id,
  );
  return { ...schedule, entries };
}

/** The week without the cell `id`. */
export function dropEntry(schedule: Schedule, id: number): Schedule {
  return { ...schedule, entries: schedule.entries.filter((item) => item.id !== id) };
}

/** The week without the hint of one person on one day ("YYYY-MM-DD"). */
export function dropHint(schedule: Schedule, employeeId: number, date: string): Schedule {
  return {
    ...schedule,
    availability: schedule.availability.map((hint) =>
      hint.employeeId === employeeId
        ? { ...hint, days: hint.days.filter((day) => day.date !== date) }
        : hint,
    ),
  };
}
