// Unit tests: plain input → output, no database or HTTP involved.
import { describe, it, expect } from "vitest";
import { createOwnerSchema } from "./authSchema.js";

const validOwner = {
  email: "owner@example.com",
  password: "correct-horse-battery",
};

describe("createOwnerSchema", () => {
  it("accepts a valid email and password", () => {
    const result = createOwnerSchema.safeParse(validOwner);
    expect(result.success).toBe(true);
  });

  it("trims and lowercases the email", () => {
    const result = createOwnerSchema.parse({
      ...validOwner,
      email: "  Owner@Example.COM ",
    });
    expect(result.email).toBe("owner@example.com");
  });

  it("rejects an invalid email", () => {
    const result = createOwnerSchema.safeParse({ ...validOwner, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a password shorter than 10 characters", () => {
    const result = createOwnerSchema.safeParse({ ...validOwner, password: "123456789" });
    expect(result.success).toBe(false);
  });

  it("rejects a password longer than 128 characters", () => {
    const result = createOwnerSchema.safeParse({
      ...validOwner,
      password: "a".repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a username shorter than 3 characters", () => {
    const result = createOwnerSchema.safeParse({ ...validOwner, username: "ab" });
    expect(result.success).toBe(false);
  });

  it("drops fields it doesn't know, like role", () => {
    const result = createOwnerSchema.parse({ ...validOwner, role: "employee" });
    expect(result).not.toHaveProperty("role");
  });
});
