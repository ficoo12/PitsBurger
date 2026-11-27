import bcrypt from "bcrypt";
import request from "supertest";
import { app } from "../src/app.js";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  generateToken,
  hashToken,
} from "../src/auth/helpers/tokens.js";
import { appUser, session } from "../src/db/schema.js";
import { db } from "./db.js";

export const TEST_PASSWORD = "correct-horse-battery";
// Cost 4 instead of the app's 12: hashed once, and only tests use it.
export const TEST_PASSWORD_HASH = bcrypt.hashSync(TEST_PASSWORD, 4);

/**
 * Inserts a user straight into the database (an owner, unless `changes`
 * says otherwise) and returns an owner-app session cookie, e.g. "session=abc".
 *
 * An owner logs in through POST /api/auth/login. That login refuses everyone
 * else, so for a non-owner the session row is inserted directly: the session
 * someone would still have from before the login was owners-only. The owner
 * routes must answer it with 403.
 */
export async function signIn(
  email: string,
  changes: Partial<typeof appUser.$inferInsert> = {}
): Promise<string> {
  const [user] = await db
    .insert(appUser)
    .values({
      email,
      passwordHash: TEST_PASSWORD_HASH,
      role: "owner",
      ...changes,
    })
    .returning({ id: appUser.id, role: appUser.role });

  if (user.role !== "owner") {
    const token = generateToken();
    await db.insert(session).values({
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    });
    return `${SESSION_COOKIE}=${token}`;
  }

  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: TEST_PASSWORD });
  if (res.status !== 200) {
    throw new Error(`Test login for ${email} failed with ${res.status}`);
  }
  const header = res.headers["set-cookie"] as unknown as string[];
  return header.find((c) => c.startsWith("session="))!.split(";")[0];
}
