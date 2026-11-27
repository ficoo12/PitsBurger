// Calendar weeks as the schedule API speaks them: Monday to Sunday, each day
// a "YYYY-MM-DD" string. The arithmetic runs in UTC, so a daylight saving
// change can't shift a day.

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function parse(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The date `days` days after `date` (before it, when negative). */
export function addDays(date: string, days: number): string {
  return format(new Date(parse(date).getTime() + days * DAY_MS));
}

/** The Monday `weeks` weeks after the Monday `weekStart`. */
export function addWeeks(weekStart: string, weeks: number): string {
  return addDays(weekStart, weeks * 7);
}

/** The Monday of the week that contains `date`. */
export function weekStartOf(date: string): string {
  // getUTCDay counts from Sunday (0); this counts days since Monday (Mon = 0).
  return addDays(date, -((parse(date).getUTCDay() + 6) % 7));
}

/** The Monday of the week the owner is in now, by their own clock. */
export function thisWeekStart(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return weekStartOf(`${now.getFullYear()}-${month}-${day}`);
}

/** Whether `value` is a real date in "YYYY-MM-DD" that falls on a Monday. */
export function isWeekStart(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parse(value);
  return !Number.isNaN(date.getTime()) && format(date) === value && date.getUTCDay() === 1;
}

/** One day of a week, for a column header. */
export type WeekDay = {
  /** "YYYY-MM-DD". */
  date: string;
  /** ISO 8601: 1 = Monday ... 7 = Sunday, like OpeningHours.weekday. */
  weekday: number;
  /** "Monday". */
  name: string;
  /** "16.11." */
  label: string;
};

/** The seven days of the week that starts on `weekStart`. */
export function weekDays(weekStart: string): WeekDay[] {
  return WEEKDAYS.map((name, index) => {
    const date = addDays(weekStart, index);
    return { date, weekday: index + 1, name, label: dayMonth(date) };
  });
}

/** "16.11." */
function dayMonth(date: string): string {
  return `${date.slice(8, 10)}.${date.slice(5, 7)}.`;
}

/** The ISO 8601 week number: week 1 is the week with the year's first Thursday. */
export function isoWeekNumber(weekStart: string): number {
  const thursday = parse(addDays(weekStart, 3));
  const firstOfYear = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - firstOfYear) / DAY_MS / 7) + 1;
}

/**
 * "16.11. – 22.11.2026 · Week 47". A week that runs into the next year names
 * both years: "29.12.2025 – 04.01.2026 · Week 1".
 */
export function weekLabel(weekStart: string): string {
  const sunday = addDays(weekStart, 6);
  const from =
    weekStart.slice(0, 4) === sunday.slice(0, 4)
      ? dayMonth(weekStart)
      : `${dayMonth(weekStart)}${weekStart.slice(0, 4)}`;
  return `${from} – ${dayMonth(sunday)}${sunday.slice(0, 4)} · Week ${isoWeekNumber(weekStart)}`;
}
