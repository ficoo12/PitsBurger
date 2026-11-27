import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";

// The E2E run uses the same ports as development: the apps' preview servers
// proxy /api to localhost:3000, which is hard-wired in their vite.config.ts.
// Stop your dev servers before running the tests.
export const API_URL = "http://localhost:3000";
export const OWNER_URL = "http://localhost:5173";
// The employee app runs under /employee (its vite.config.ts `base`), as on
// Vercel. Use `${EMPLOYEE_URL}/…` in page.goto: a bare "/…" would drop the
// /employee part, because a path starting with / replaces the baseURL's path.
export const EMPLOYEE_URL = "http://localhost:5174/employee";

export const backendDir = fileURLToPath(new URL("../../backend/", import.meta.url));

/**
 * DATABASE_URL from the environment (CI) or, locally, from backend/.env.
 * The file is only read, never changed.
 */
function baseDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const file = `${backendDir}.env`;
  const url = existsSync(file)
    ? parseEnv(readFileSync(file, "utf8")).DATABASE_URL
    : undefined;
  if (!url) {
    throw new Error("Set DATABASE_URL, or create backend/.env from .env.example");
  }
  return url;
}

/**
 * The database the E2E run uses: DATABASE_URL with "_e2e" added to the name
 * (…/pitsburger → …/pitsburger_e2e). It is dropped and recreated on every run,
 * so it must never be the dev or the Vitest database.
 */
function resolveE2eDatabaseUrl(): string {
  const url = new URL(baseDatabaseUrl());
  url.pathname = `${url.pathname}_e2e`;
  return url.toString();
}

export const e2eDatabaseUrl = resolveE2eDatabaseUrl();

/**
 * Environment for the backend server and the create-owner script. Set values
 * win over backend/.env (dotenv never overrides), so the server uses the E2E
 * database and has no file storage: R2 is blanked so no test uploads for real.
 */
export const backendEnv: Record<string, string> = {
  DATABASE_URL: e2eDatabaseUrl,
  PORT: "3000",
  // Not "production": that makes the session cookie Secure, and WebKit doesn't
  // send Secure cookies to http://localhost (Chromium does). Not "test" either:
  // that would switch off the login rate limits the tests rely on.
  NODE_ENV: "development",
  CORS_ORIGIN: OWNER_URL,
  R2_ACCOUNT_ID: "",
  R2_ACCESS_KEY_ID: "",
  R2_SECRET_ACCESS_KEY: "",
  R2_BUCKET: "",
};
