// Postgres error 23505 = unique violation.
// Drizzle wraps the pg error, so the Postgres code sits on `cause`.
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}
