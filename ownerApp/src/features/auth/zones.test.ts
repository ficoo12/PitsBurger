import { describe, expect, it } from "vitest";
import type { User } from "./types";
import { zoneHome, zoneOf } from "./zones";

const user: User = {
  id: 1,
  email: "ana@example.com",
  firstName: "Ana",
  lastName: "Horvat",
  username: null,
  role: "owner",
  avatarUrl: null,
  createdAt: "2026-11-07T21:48:43.781Z",
};

describe("zoneOf", () => {
  it("is guest without a user", () => {
    expect(zoneOf(null)).toBe("guest");
  });

  it("is signedIn with an owner", () => {
    expect(zoneOf(user)).toBe("signedIn");
  });

  it("is guest with an employee", () => {
    expect(zoneOf({ ...user, role: "employee" })).toBe("guest");
  });
});

describe("zoneHome", () => {
  it("sends each zone to its start page", () => {
    expect(zoneHome).toEqual({
      guest: "/login",
      signedIn: "/dashboard",
    });
  });
});
