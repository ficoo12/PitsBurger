import "dotenv/config";

/**
 * The database the tests run against. It is wiped before every test, so it
 * must never be your dev database.
 *
 * By default it's your DATABASE_URL with "_test" added to the database name
 * (e.g. .../pitsburger -> .../pitsburger_test). Set TEST_DATABASE_URL in .env
 * to use a different one.
 */
function resolveTestDatabaseUrl(): string {
  const devUrl = process.env.DATABASE_URL;
  const explicit = process.env.TEST_DATABASE_URL;
  if (!explicit && !devUrl) {
    throw new Error("Set DATABASE_URL (or TEST_DATABASE_URL) in backend/.env");
  }

  const url = new URL(explicit ?? devUrl!);
  if (!explicit) url.pathname = `${url.pathname}_test`;

  // Safety net: refuse anything that doesn't look like a test database.
  if (!url.pathname.endsWith("_test")) {
    throw new Error(
      `Test database name must end with "_test" (got "${url.pathname.slice(1)}")`
    );
  }
  return url.toString();
}

export const testDatabaseUrl = resolveTestDatabaseUrl();
