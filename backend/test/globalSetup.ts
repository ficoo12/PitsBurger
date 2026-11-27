import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { testDatabaseUrl } from "./testDatabaseUrl.js";

/**
 * Runs once before all tests: creates the test database if it doesn't exist
 * yet, then applies the migrations from ./drizzle so its tables match the
 * real schema.
 */
export default async function setup() {
  const url = new URL(testDatabaseUrl);
  const dbName = url.pathname.slice(1);

  // CREATE DATABASE has to be run while connected to some other database.
  url.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    const existing = await admin.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [dbName]
    );
    if (existing.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${dbName.replaceAll('"', '""')}"`);
    }
  } finally {
    await admin.end();
  }

  const db = drizzle(testDatabaseUrl);
  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
  } finally {
    await db.$client.end();
  }
}
