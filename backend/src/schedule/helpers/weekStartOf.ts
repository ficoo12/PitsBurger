/** The Monday (YYYY-MM-DD) of the week that contains the date (YYYY-MM-DD). */
export function weekStartOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  // getUTCDay counts from Sunday (0); this counts days since Monday (Mon = 0).
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
