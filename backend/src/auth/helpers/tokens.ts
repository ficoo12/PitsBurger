import { createHash, randomBytes } from "node:crypto";
import type { CookieOptions } from "express";

export const SESSION_COOKIE = "session";
/**
 * The employee app's session. It has its own name so it never replaces the
 * owner's `session` cookie: on localhost both apps share cookies (ports don't
 * count). Set and cleared with the same sessionCookieOptions.
 */
export const EMPLOYEE_SESSION_COOKIE = "employee_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Used both to set and to clear the session cookie. The browser only removes
// a cookie when these options match the ones it was set with.
export const sessionCookieOptions: CookieOptions = {
  httpOnly: true,
  // Vercel sets NODE_ENV=production, so the deployed app sends the cookie over
  // HTTPS only. Local dev and the tests run over plain http, where a secure
  // cookie would not come back.
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

/** Random token for a session cookie. Only its hash goes in the database. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
