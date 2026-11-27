import { scheduleEntry } from "../../db/schema.js";

// What the API returns for a schedule cell. schedule_id and the integrity
// helpers (restaurant_id, week_start) stay internal.
export const entryColumns = {
  id: scheduleEntry.id,
  employeeId: scheduleEntry.employeeId,
  workDate: scheduleEntry.workDate,
  shiftId: scheduleEntry.shiftId,
  startTime: scheduleEntry.startTime,
  endTime: scheduleEntry.endTime,
  note: scheduleEntry.note,
};

/** Postgres returns times as HH:MM:SS; the API speaks HH:MM. */
export function formatEntry<
  T extends { startTime: string | null; endTime: string | null },
>(row: T): T {
  return {
    ...row,
    startTime: row.startTime?.slice(0, 5) ?? null,
    endTime: row.endTime?.slice(0, 5) ?? null,
  };
}
