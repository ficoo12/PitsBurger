import { describe, expect, it } from "vitest";
import { testEmployee } from "../../test/fixtures";
import { zoneHome, zoneOf } from "./zones";

describe("zoneOf", () => {
  it("is guest without a user", () => {
    expect(zoneOf(null)).toBe("guest");
  });

  it("is employee for a signed-in employee", () => {
    expect(zoneOf(testEmployee)).toBe("employee");
  });
});

describe("zoneHome", () => {
  it("sends each zone to its start page", () => {
    expect(zoneHome).toEqual({
      guest: "/",
      employee: "/availability",
    });
  });
});
