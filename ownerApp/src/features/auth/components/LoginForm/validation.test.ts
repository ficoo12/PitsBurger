import { describe, it, expect } from "vitest";
import { EMPTY, FIELDS, validate, type Values } from "./validation";

// A form that passes every check. Each test changes ONE field from this.
const valid: Values = {
  email: "ana@example.com",
  password: "correct-horse",
};

describe("validate", () => {
  it("returns no errors for a valid form", () => {
    expect(validate(valid)).toEqual({});
  });

  it("returns an error for every field of an empty form", () => {
    expect(validate(EMPTY)).toEqual({
      email: "Enter your email address.",
      password: "Enter your password.",
    });
  });

  describe("email", () => {
    it("is required", () => {
      const errors = validate({ ...valid, email: "" });
      expect(errors).toEqual({ email: "Enter your email address." });
    });

    it("can't be only spaces", () => {
      const errors = validate({ ...valid, email: "   " });
      expect(errors).toEqual({ email: "Enter your email address." });
    });

    it.each([
      ["no @", "ana.example.com"],
      ["nothing before the @", "@example.com"],
      ["nothing after the @", "ana@"],
      ["no dot in the domain", "ana@example"],
      ["nothing after the dot", "ana@example."],
      ["a space inside", "ana horvat@example.com"],
      ["two @", "ana@@example.com"],
    ])("rejects an address with %s", (_case, email) => {
      const errors = validate({ ...valid, email });
      expect(errors).toEqual({
        email: "Enter a valid email address, like name@example.com.",
      });
    });

    it.each([
      ["a plain address", "ana@example.com"],
      ["a subdomain", "ana@mail.example.com"],
      ["a plus tag", "ana+shop@example.com"],
      ["uppercase letters", "Ana@Example.COM"],
      ["spaces around it", "  ana@example.com  "],
    ])("accepts %s", (_case, email) => {
      expect(validate({ ...valid, email })).toEqual({});
    });
  });

  describe("password", () => {
    it("is required", () => {
      const errors = validate({ ...valid, password: "" });
      expect(errors).toEqual({ password: "Enter your password." });
    });

    it("has no minimum length", () => {
      expect(validate({ ...valid, password: "a" })).toEqual({});
    });

    it("accepts only spaces, because passwords are not trimmed", () => {
      expect(validate({ ...valid, password: " " })).toEqual({});
    });
  });
});

describe("FIELDS", () => {
  it("lists every form field, top to bottom", () => {
    expect(FIELDS).toEqual(["email", "password"]);
    expect([...FIELDS].sort()).toEqual(Object.keys(EMPTY).sort());
  });
});
