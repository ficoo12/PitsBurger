import { describe, expect, it } from "vitest";
import { PALETTE, SHADES, nextFree, paletteVar, restaurantGradient } from "./palette";

describe("nextFree", () => {
  it("returns the first value in order that isn't taken", () => {
    expect(nextFree(PALETTE, [])).toBe("red");
    expect(nextFree(PALETTE, ["red", "yellow"])).toBe("orange");
    expect(nextFree(SHADES, ["late"])).toBe("early");
  });

  it("returns null when every value is taken", () => {
    expect(nextFree(SHADES, ["full", "early", "late"])).toBeNull();
  });
});

describe("paletteVar", () => {
  it("names the colour's token in the shade", () => {
    expect(paletteVar("teal", "full")).toBe("var(--palette-teal-full)");
  });
});

describe("restaurantGradient", () => {
  it("runs from the Early to the Late shade", () => {
    expect(restaurantGradient("pink")).toBe(
      "linear-gradient(180deg, var(--palette-pink-early), var(--palette-pink-late))",
    );
  });
});
