import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";

export const db = drizzle({
  connection: {
    connectionString: process.env.DATABASE_URL!,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 15_000,
  },
});
