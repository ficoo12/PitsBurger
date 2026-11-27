// Dates and times for the availability screen. The server sends Berlin dates
// ("YYYY-MM-DD") and times ("HH:MM"); these only turn them into text, so they
// read the dates as UTC to stay on the same calendar day in any time zone.

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

function utc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function addDays(date: string, days: number): string {
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "Monday" for ISO weekday 1. */
export function weekdayName(weekday: number): string {
  return WEEKDAYS[weekday - 1];
}

/** "Mon" for ISO weekday 1. */
export function weekdayShort(weekday: number): string {
  return weekdayName(weekday).slice(0, 3);
}

/** "30 Nov". */
export function dayMonth(date: string): string {
  return DAY_MONTH.format(utc(date));
}

/** "30 Nov – 6 Dec 2026" for the week starting on that Monday. */
export function weekRange(weekStart: string): string {
  const sunday = addDays(weekStart, 6);
  return `${dayMonth(weekStart)} – ${dayMonth(sunday)} ${sunday.slice(0, 4)}`;
}

/** The ISO week number of the week starting on that Monday. */
export function isoWeek(weekStart: string): number {
  // The ISO week belongs to the year its Thursday is in.
  const thursday = utc(addDays(weekStart, 3));
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - yearStart) / 86_400_000 / 7) + 1;
}

/** "Sunday, 23:59". */
export function weekdayTime(weekday: number, time: string): string {
  return `${weekdayName(weekday)}, ${time}`;
}

/** "Friday, 4 Dec, 00:00". */
export function dateTime(date: string, time: string): string {
  const weekday = ((utc(date).getUTCDay() + 6) % 7) + 1;
  return `${weekdayName(weekday)}, ${dayMonth(date)}, ${time}`;
}

/** "1 change", "2 changes". */
export function changes(count: number): string {
  return `${count} ${count === 1 ? "change" : "changes"}`;
}

/** "once", "twice", "3 times". */
export function times(count: number): string {
  return count === 1 ? "once" : count === 2 ? "twice" : `${count} times`;
}
