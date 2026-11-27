import { sql } from "drizzle-orm";
import { db } from "../src/db/dbcon.js";

/** Empties every table so each test starts from a clean database. */
export async function resetDatabase() {
  await db.execute(
    sql`TRUNCATE app_user, session, restaurant, restaurant_opening_hours RESTART IDENTITY CASCADE`
  );
}

/** Closes the connection pool so the test process can exit. */
export async function closeDatabase() {
  await db.$client.end();
}

export { db };
