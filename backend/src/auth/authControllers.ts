import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "../db/dbcon.js";
import { appUser, session } from "../db/schema.js";
import { loginSchema } from "./authSchema.js";
import {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  generateToken,
  hashToken,
  sessionCookieOptions,
} from "./helpers/tokens.js";
import { DUMMY_HASH } from "./helpers/dummyHash.js";
import { publicUserColumns } from "./helpers/publicUserColumns.js";
import type { AuthedResponse } from "./authMiddleware.js";

export async function me(_req: Request, res: AuthedResponse) {
  return res.json({ user: res.locals.user });
}

export async function login(req: Request, res: Response) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid input",
      fields: z.flattenError(parsed.error).fieldErrors,
    });
  }

  const { email, password } = parsed.data;

  const [row] = await db
    .select({ ...publicUserColumns, passwordHash: appUser.passwordHash })
    .from(appUser)
    .where(eq(appUser.email, email))
    .limit(1);

  const ok = await bcrypt.compare(password, row?.passwordHash ?? DUMMY_HASH);

  // Only owners log in here; employees use POST /api/employees/login. A
  // non-owner gets the same 401 as a wrong password, so this login never
  // tells whether an employee account exists.
  if (!row || !ok || !row.passwordHash || row.role !== "owner") {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const { passwordHash: _, ...user } = row;

  // Replace any session this browser already has, so old rows don't pile up
  // for 30 days and every login starts with a fresh token.
  const oldToken: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof oldToken === "string" && oldToken !== "") {
    await db.delete(session).where(eq(session.tokenHash, hashToken(oldToken)));
  }

  const now = Date.now();
  const sessionToken = generateToken();

  await db.insert(session).values({
    tokenHash: hashToken(sessionToken),
    userId: user.id,
    expiresAt: new Date(now + SESSION_TTL_MS),
  });

  res.cookie(SESSION_COOKIE, sessionToken, {
    ...sessionCookieOptions,
    maxAge: SESSION_TTL_MS,
  });

  return res.json({ user });
}

export async function logout(req: Request, res: Response) {
  const token: unknown = req.cookies?.[SESSION_COOKIE];

  if (typeof token === "string" && token !== "") {
    await db.delete(session).where(eq(session.tokenHash, hashToken(token)));
  }

  res.clearCookie(SESSION_COOKIE, sessionCookieOptions);

  return res.status(204).end();
}
