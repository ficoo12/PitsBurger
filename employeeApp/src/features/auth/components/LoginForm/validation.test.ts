import { describe, expect, it } from "vitest";
import { EMPTY, validate } from "./validation";

describe("validate", () => {
  it("asks for both fields when the form is empty", () => {
    expect(validate(EMPTY)).toEqual({
      username: "Enter your username.",
      password: "Enter your password.",
    });
  });

  it("treats a username of only spaces as empty", () => {
    expect(validate({ username: "   ", password: "secret" })).toEqual({
      username: "Enter your username.",
    });
  });

  it("accepts a password of only spaces: it is sent as typed", () => {
    expect(validate({ username: "jonas.becker", password: "   " })).toEqual({});
  });

  it("has no errors for a filled-in form", () => {
    expect(validate({ username: "jonas.becker", password: "13031998" })).toEqual({});
  });
});
