/**
 * The start and end times a cell stores. A changed time equal to the shift's
 * own time is stored as "no change" (null), so the cell shows plain "Früh" and
 * follows the shift if its times are edited later. Returns null when the cell
 * would start and end at the same time.
 */
export function changedTimes(
  shift: { startTime: string; endTime: string },
  startTime: string | null,
  endTime: string | null
) {
  // Postgres returns HH:MM:SS; the API speaks HH:MM.
  const shiftStart = shift.startTime.slice(0, 5);
  const shiftEnd = shift.endTime.slice(0, 5);
  const start = startTime === shiftStart ? null : startTime;
  const end = endTime === shiftEnd ? null : endTime;
  if ((start ?? shiftStart) === (end ?? shiftEnd)) return null;
  return { startTime: start, endTime: end };
}
