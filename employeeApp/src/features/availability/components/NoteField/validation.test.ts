import { describe, expect, it } from "vitest";
import { noteForApi, validateNote } from "./validation";

describe("validateNote", () => {
  it("accepts up to 100 characters after trimming", () => {
    expect(validateNote("")).toBeUndefined();
    expect(validateNote(`  ${"x".repeat(100)}  `)).toBeUndefined();
  });

  it("rejects 101 characters", () => {
    expect(validateNote("x".repeat(101))).toBe("Keep the note to 100 characters.");
  });
});

describe("noteForApi", () => {
  it("trims the note and sends null for an empty one", () => {
    expect(noteForApi("  Only after 12 ")).toBe("Only after 12");
    expect(noteForApi("   ")).toBeNull();
  });
});
