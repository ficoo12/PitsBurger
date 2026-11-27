import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { app } from "../app.js";
import { appUser, session } from "../db/schema.js";
import { db, resetDatabase, closeDatabase } from "../../test/db.js";
import { TEST_PASSWORD, TEST_PASSWORD_HASH } from "../../test/auth.js";

const owner = {
  email: "owner@example.com",
  password: TEST_PASSWORD,
  firstName: "Ana",
  lastName: "Horvat",
  username: "ana",
};

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

/** Creates the owner account, as `npm run create-owner` does. No session yet. */
async function insertOwner() {
  const { password: _, ...columns } = owner;
  await db
    .insert(appUser)
    .values({ ...columns, passwordHash: TEST_PASSWORD_HASH, role: "owner" });
}

/** Creates the owner and logs in once, e.g. on another device. */
async function insertOwnerAndLogIn() {
  await insertOwner();
  return logIn();
}

async function logIn(
  body: Record<string, unknown> = {
    email: owner.email,
    password: owner.password,
  },
  cookie?: string
) {
  const req = request(app).post("/api/auth/login");
  if (cookie) req.set("Cookie", cookie);
  const res = await req.send(body);
  return { res, sessionCookie: getSessionCookie(res) };
}

function getSessionCookie(res: request.Response): string | undefined {
  const header = res.headers["set-cookie"] as unknown as string[] | undefined;
  return header?.find((c) => c.startsWith("session="))?.split(";")[0];
}

describe("POST /api/auth/login", () => {
  it("returns 200 and the public user", async () => {
    await insertOwner();

    const { res } = await logIn();

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      email: "owner@example.com",
      username: "ana",
      role: "owner",
    });
    expect(res.body.user).not.toHaveProperty("passwordHash");
    expect(res.body.user).not.toHaveProperty("googleId");
  });

  it("sets an httpOnly session cookie that works for /api/auth/me", async () => {
    await insertOwner();

    const { res, sessionCookie } = await logIn();

    expect(sessionCookie).toBeDefined();
    const rawCookie = (res.headers["set-cookie"] as unknown as string[])[0];
    expect(rawCookie).toMatch(/HttpOnly/i);
    expect(rawCookie).toMatch(/SameSite=Lax/i);

    const me = await request(app).get("/api/auth/me").set("Cookie", sessionCookie!);
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe("owner@example.com");
  });

  it("accepts the email in any casing, with surrounding spaces", async () => {
    await insertOwner();

    const { res } = await logIn({
      email: "  Owner@Example.COM ",
      password: owner.password,
    });

    expect(res.status).toBe(200);
  });

  it("returns 401 for a wrong password", async () => {
    await insertOwner();

    const { res, sessionCookie } = await logIn({
      email: owner.email,
      password: "wrong-horse-battery",
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Invalid email or password");
    expect(sessionCookie).toBeUndefined();
    expect(await db.select().from(session)).toHaveLength(0);
  });

  it("does not trim the password", async () => {
    await insertOwner();

    const { res } = await logIn({
      email: owner.email,
      password: `${owner.password} `,
    });

    expect(res.status).toBe(401);
  });

  it("returns the same 401 for an unknown email", async () => {
    await insertOwner();

    const { res, sessionCookie } = await logIn({
      email: "nobody@example.com",
      password: owner.password,
    });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid email or password" });
    expect(sessionCookie).toBeUndefined();
  });

  it("returns 401 for an account without a password", async () => {
    await db.insert(appUser).values({
      email: "google@example.com",
      passwordHash: null,
      googleId: "google-123",
      role: "owner",
    });

    const { res } = await logIn({
      email: "google@example.com",
      password: "dummy-password-for-timing",
    });

    expect(res.status).toBe(401);
    expect(await db.select().from(session)).toHaveLength(0);
  });

  it("returns the same 401 for an employee who has no password", async () => {
    // An employee whose contract doesn't submit availability.
    await db.insert(appUser).values({
      email: "employee@example.com",
      passwordHash: null,
      role: "employee",
    });

    const { res } = await logIn({
      email: "employee@example.com",
      password: "dummy-password-for-timing",
    });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid email or password" });
    expect(await db.select().from(session)).toHaveLength(0);
  });

  it("returns the same 401 for an employee with the right password", async () => {
    // Employees log in to the employee app (POST /api/employees/login), not here.
    await db.insert(appUser).values({
      email: "employee@example.com",
      passwordHash: TEST_PASSWORD_HASH,
      role: "employee",
    });

    const { res, sessionCookie } = await logIn({
      email: "employee@example.com",
      password: TEST_PASSWORD,
    });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid email or password" });
    expect(sessionCookie).toBeUndefined();
    expect(await db.select().from(session)).toHaveLength(0);
  });

  it("returns 400 with field errors for invalid input", async () => {
    const { res } = await logIn({ email: "nope", password: "" });

    expect(res.status).toBe(400);
    expect(res.body.fields).toHaveProperty("email");
    expect(res.body.fields).toHaveProperty("password");
  });

  it("replaces the session this browser already has", async () => {
    const { sessionCookie: oldCookie } = await insertOwnerAndLogIn();

    const { sessionCookie: newCookie } = await logIn(undefined, oldCookie);

    expect(newCookie).toBeDefined();
    expect(newCookie).not.toBe(oldCookie);
    expect(await db.select().from(session)).toHaveLength(1);
    const me = await request(app).get("/api/auth/me").set("Cookie", oldCookie!);
    expect(me.status).toBe(401);
  });

  it("keeps other sessions when no cookie is sent", async () => {
    const { sessionCookie: otherDevice } = await insertOwnerAndLogIn();

    await logIn();

    expect(await db.select().from(session)).toHaveLength(2);
    const me = await request(app).get("/api/auth/me").set("Cookie", otherDevice!);
    expect(me.status).toBe(200);
  });
});

describe("POST /api/auth/logout", () => {
  it("returns 204, deletes the session and clears the cookie", async () => {
    const { sessionCookie } = await insertOwnerAndLogIn();

    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", sessionCookie!);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(getSessionCookie(res)).toBe("session="); // cleared
    expect(await db.select().from(session)).toHaveLength(0);
  });

  it("makes the old cookie useless for /api/auth/me", async () => {
    const { sessionCookie } = await insertOwnerAndLogIn();
    await request(app).post("/api/auth/logout").set("Cookie", sessionCookie!);

    const me = await request(app).get("/api/auth/me").set("Cookie", sessionCookie!);

    expect(me.status).toBe(401);
  });

  it("only ends this session, not the user's other sessions", async () => {
    const { sessionCookie: otherDevice } = await insertOwnerAndLogIn();
    const { sessionCookie: thisDevice } = await logIn();

    await request(app).post("/api/auth/logout").set("Cookie", thisDevice!);

    expect(await db.select().from(session)).toHaveLength(1);
    const me = await request(app).get("/api/auth/me").set("Cookie", otherDevice!);
    expect(me.status).toBe(200);
  });

  it("returns 204 without a session cookie", async () => {
    await insertOwnerAndLogIn();

    const res = await request(app).post("/api/auth/logout");

    expect(res.status).toBe(204);
    expect(getSessionCookie(res)).toBe("session="); // cleared
    expect(await db.select().from(session)).toHaveLength(1);
  });

  it("returns 204 for an unknown session and leaves others alone", async () => {
    await insertOwnerAndLogIn();

    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", "session=not-a-real-session");

    expect(res.status).toBe(204);
    expect(await db.select().from(session)).toHaveLength(1);
  });

  it("allows logging in again afterwards", async () => {
    const { sessionCookie } = await insertOwnerAndLogIn();
    await request(app).post("/api/auth/logout").set("Cookie", sessionCookie!);

    const { res } = await logIn();

    expect(res.status).toBe(200);
  });
});

describe("GET /api/auth/me", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
  });

  it("returns the user for the session cookie", async () => {
    const { sessionCookie } = await insertOwnerAndLogIn();

    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", sessionCookie!);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("owner@example.com");
    expect(res.body.user).not.toHaveProperty("passwordHash");
  });

  it("returns 401 and clears the cookie for an unknown session", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", "session=not-a-real-session");

    expect(res.status).toBe(401);
    expect(getSessionCookie(res)).toBe("session="); // cleared
  });

  it("returns 401 for an expired session", async () => {
    const { sessionCookie } = await insertOwnerAndLogIn();
    await db.update(session).set({ expiresAt: new Date(Date.now() - 1000) });

    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", sessionCookie!);

    expect(res.status).toBe(401);
  });
});
