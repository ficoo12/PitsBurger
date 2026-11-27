import type { NextFunction, Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db/dbcon.js";
import { appUser, session } from "../db/schema.js";
import { publicUserColumns } from "../auth/helpers/publicUserColumns.js";
import {
  EMPLOYEE_SESSION_COOKIE,
  hashToken,
  sessionCookieOptions,
} from "../auth/helpers/tokens.js";

/**
 * Guard for the employee app. Answers 401 unless the request carries a valid,
 * unexpired `employee_session` cookie of an employee account. It never reads
 * the owner's `session` cookie, and an owner's token put in this cookie counts
 * as no session. Sets res.locals.user like requireAuth, so routes after it use
 * AuthedResponse.
 */
export async function requireEmployee(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token: unknown = req.cookies?.[EMPLOYEE_SESSION_COOKIE];
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
        gt(session.expiresAt, new Date()),
        eq(appUser.role, "employee")
      )
    )
    .limit(1);

  if (!user) {
    res.clearCookie(EMPLOYEE_SESSION_COOKIE, sessionCookieOptions);
    return res.status(401).json({ error: "Not signed in" });
  }

  res.locals.user = user;
  next();
}
