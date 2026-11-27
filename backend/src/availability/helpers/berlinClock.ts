import { weekStartOf } from "../../schedule/helpers/weekStartOf.js";

/** A moment as the restaurants see it: Europe/Berlin, minute precision. */
export type BerlinMoment = {
  /** "YYYY-MM-DD". */
  date: string;
  /** ISO weekday: 1 = Monday ... 7 = Sunday. */
  weekday: number;
  /** "HH:MM", 24-hour clock. */
  time: string;
};

/** The opening and closing of the availability window. */
export type AvailabilityWindow = {
  opensWeekday: number;
  opensTime: string;
  closesWeekday: number;
  closesTime: string;
};

const berlinFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * The moment in Berlin. The window and the weeks are always German time,
 * whatever time zone the server runs in; Intl also handles summer time.
 */
export function berlinNow(now: Date = new Date()): BerlinMoment {
  const parts = Object.fromEntries(
    berlinFormat.formatToParts(now).map((part) => [part.type, part.value])
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  // getUTCDay counts from Sunday (0); ISO weekdays count from Monday (1).
  const weekday = ((new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1;
  return { date, weekday, time: `${parts.hour}:${parts.minute}` };
}

/** The date (YYYY-MM-DD) that many days later; negative goes back. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The Monday of the week after the one that contains the date. */
export function nextWeekStart(date: string): string {
  return addDays(weekStartOf(date), 7);
}

/** Whether this week's opening minute has been reached. */
function hasOpenedThisWeek(
  window: AvailabilityWindow,
  now: Pick<BerlinMoment, "weekday" | "time">
): boolean {
  // "HH:MM" strings compare correctly as text.
  return (
    now.weekday > window.opensWeekday ||
    (now.weekday === window.opensWeekday && now.time >= window.opensTime)
  );
}

/**
 * Whether the window is open at this moment: from the opening minute until
 * the end of the closing minute ("23:59" lasts until 23:59:59). The window
 * always lies inside one Monday–Sunday week.
 */
export function isWindowOpen(
  window: AvailabilityWindow,
  now: Pick<BerlinMoment, "weekday" | "time">
): boolean {
  const notClosed =
    now.weekday < window.closesWeekday ||
    (now.weekday === window.closesWeekday && now.time <= window.closesTime);
  return hasOpenedThisWeek(window, now) && notClosed;
}

/**
 * The week the employee app shows. Once this week's window has opened (during
 * it and after it) that is next week, the week the window is for. Before it
 * opens it is this week: the one they submitted for in last week's window.
 * So the app switches to a fresh week, with fresh saves, as the window opens.
 */
export function shownWeekStart(
  window: AvailabilityWindow,
  now: BerlinMoment
): string {
  return hasOpenedThisWeek(window, now)
    ? nextWeekStart(now.date)
    : weekStartOf(now.date);
}

/** When the window opens next (Berlin date and time); null while it is open. */
export function nextOpening(
  window: AvailabilityWindow,
  now: BerlinMoment
): { date: string; time: string } | null {
  if (isWindowOpen(window, now)) return null;
  const monday = hasOpenedThisWeek(window, now)
    ? nextWeekStart(now.date)
    : weekStartOf(now.date);
  return { date: addDays(monday, window.opensWeekday - 1), time: window.opensTime };
}
