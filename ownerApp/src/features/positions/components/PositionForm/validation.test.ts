import { describe, expect, it } from "vitest";
import { emptyValues, fromPosition, toInput, validate } from "./validation";

describe("validate", () => {
  it("accepts a name and a colour", () => {
    expect(validate({ name: "Service", colour: "red" })).toEqual({});
  });

  it("asks for a name", () => {
    expect(validate({ name: "   ", colour: "red" }).name).toBe("Enter the position's name.");
  });

  it("limits the name to 100 characters", () => {
    expect(validate({ name: "a".repeat(100), colour: "red" }).name).toBeUndefined();
    expect(validate({ name: "a".repeat(101), colour: "red" }).name).toBe(
      "Use at most 100 characters.",
    );
  });

  it("asks for a colour", () => {
    expect(validate({ name: "Service", colour: null }).colour).toBe("Pick a colour.");
  });
});

describe("toInput", () => {
  it("trims the name and sends the colour", () => {
    expect(toInput({ name: "  Küche ", colour: "yellow" })).toEqual({
      name: "Küche",
      colour: "yellow",
    });
  });
});

describe("emptyValues", () => {
  it("starts a new position with the given colour", () => {
    expect(emptyValues("teal")).toEqual({ name: "", colour: "teal" });
  });
});

describe("fromPosition", () => {
  it("starts the form with the position's name and colour", () => {
    expect(fromPosition({ id: 3, name: "Küche", colour: "yellow" })).toEqual({
      name: "Küche",
      colour: "yellow",
    });
  });
});
