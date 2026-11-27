import type { NextFunction, Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db/dbcon.js";
import { appUser, session } from "../db/schema.js";
import {
  publicUserColumns,
  type PublicUser,
} from "./helpers/publicUserColumns.js";
import {
  SESSION_COOKIE,
  hashToken,
  sessionCookieOptions,
} from "./helpers/tokens.js";

/** Response of a route that runs after requireAuth: res.locals.user is set. */
export type AuthedResponse = Response<unknown, { user: PublicUser }>;

/** Answers 401 unless the request carries a valid, unexpired session cookie. */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string" || token === "") {
    return res.status(401).json({ error: "Not signed in" });
  }

  const [user] = await db
    .select(publicUserColumns)
    .from(session)
    .innerJoin(appUser, eq(session.userId, appUser.id))
    .where(
      and(
        eq(session.tokenHash, hashToken(token)),
        gt(session.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!user) {
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions);
    return res.status(401).json({ error: "Not signed in" });
  }

  res.locals.user = user;
  next();
}

/** Must run after requireAuth. */
export function requireOwner(
  _req: Request,
  res: AuthedResponse,
  next: NextFunction
) {
  const { user } = res.locals;
  if (user.role !== "owner") {
    return res.status(403).json({ error: "Only owners can do this" });
  }
  next();
}
