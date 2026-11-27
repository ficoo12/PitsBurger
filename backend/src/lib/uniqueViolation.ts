// Postgres error 23505 = unique violation; `constraint` names the index that
// was hit. Drizzle wraps the pg error, so it may sit on `cause`.
type PgError = { code?: string; constraint?: string };

/**
 * The name of the unique constraint a query violated, or null for any other
 * error. Lets a controller tell two unique rules of one table apart, e.g. a
 * taken name from a taken colour.
 */
export function uniqueViolationConstraint(err: unknown): string | null {
  const e = err as (PgError & { cause?: PgError }) | null | undefined;
  const pg = e?.code === "23505" ? e : e?.cause?.code === "23505" ? e.cause : null;
  return pg ? (pg.constraint ?? null) : null;
}
