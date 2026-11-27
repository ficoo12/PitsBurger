// Gives the E2E run an empty, fully migrated database. Runs as part of the
// backend's webServer command (see playwright.config.ts), so it finishes
// before the backend starts:
//   1. DROP + CREATE the database in DATABASE_URL (its name must end in _e2e)
//   2. drizzle-kit migrate from backend/
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const backendDir = fileURLToPath(new URL("../../backend/", import.meta.url));

const url = new URL(process.env.DATABASE_URL ?? "");
const name = decodeURIComponent(url.pathname.slice(1));

// Safety net: never drop anything that isn't the E2E database.
if (!name.endsWith("_e2e")) {
  throw new Error(`E2E database name must end with "_e2e" (got "${name}")`);
}

// DROP/CREATE DATABASE have to run while connected to some other database.
url.pathname = "/postgres";
const admin = new pg.Client({ connectionString: url.toString() });
await admin.connect();
try {
  const quoted = `"${name.replaceAll('"', '""')}"`;
  await admin.query(`DROP DATABASE IF EXISTS ${quoted} WITH (FORCE)`);
  await admin.query(`CREATE DATABASE ${quoted}`);
} finally {
  await admin.end();
}

const migrate = spawnSync("npx", ["drizzle-kit", "migrate"], {
  cwd: backendDir,
  env: process.env,
  stdio: "inherit",
});
process.exit(migrate.status ?? 1);
