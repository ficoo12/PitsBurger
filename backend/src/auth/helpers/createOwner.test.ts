import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { ZodError } from "zod";
import { app } from "../../app.js";
import { appUser } from "../../db/schema.js";
import { db, resetDatabase, closeDatabase } from "../../../test/db.js";
import { createOwner } from "./createOwner.js";
import { isUniqueViolation } from "./isUniqueViolation.js";

const input = {
  email: "  Ana@Example.COM ",
  password: "correct-horse-battery",
  firstName: "Ana",
  lastName: "Horvat",
};

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe("createOwner", () => {
  it("creates an owner and returns only the public columns", async () => {
    const owner = await createOwner(input);

    expect(owner).toMatchObject({
      email: "ana@example.com",
      firstName: "Ana",
      lastName: "Horvat",
      username: null,
      role: "owner",
    });
    expect(owner).not.toHaveProperty("passwordHash");
  });

  it("stores a bcrypt hash, not the plain password", async () => {
    await createOwner(input);

    const [row] = await db
      .select()
      .from(appUser)
      .where(eq(appUser.email, "ana@example.com"));
    expect(row.passwordHash).not.toBe(input.password);
    expect(await bcrypt.compare(input.password, row.passwordHash!)).toBe(true);
  });

  it("creates an owner who can log in", async () => {
    await createOwner(input);

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ana@example.com", password: input.password });

    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe("owner");
  });

  it("rejects invalid input without inserting anything", async () => {
    await expect(
      createOwner({ ...input, password: "too-short" })
    ).rejects.toBeInstanceOf(ZodError);
    expect(await db.select().from(appUser)).toHaveLength(0);
  });

  it("fails with a unique violation when the email is taken", async () => {
    await createOwner(input);

    const err = await createOwner({ ...input, email: "ana@example.com" }).catch(
      (e: unknown) => e
    );

    expect(isUniqueViolation(err)).toBe(true);
  });
});
