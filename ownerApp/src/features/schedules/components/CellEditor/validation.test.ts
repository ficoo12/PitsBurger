import { describe, expect, it } from "vitest";
import type { ShiftTime } from "../../../restaurants";
import { fromEntry, fromHint, isHintAsIs, toInput, validate, type Values } from "./validation";

const shifts: ShiftTime[] = [
  { shiftId: 1, name: "Früh", startTime: "08:00", endTime: "16:00", shade: "early", ownTimes: false },
  { shiftId: 2, name: "Spät", startTime: "16:00", endTime: "00:00", shade: "late", ownTimes: false },
];

const valid: Values = { shiftId: 2, startTime: "", endTime: "", note: "" };

describe("fromEntry", () => {
  it("starts an empty cell with no shift and empty fields", () => {
    expect(fromEntry(undefined)).toEqual({ shiftId: null, startTime: "", endTime: "", note: "" });
  });

  it("fills in a saved cell", () => {
    expect(
      fromEntry({
        id: 1,
        employeeId: 7,
        workDate: "2026-11-17",
        shiftId: 2,
        startTime: "18:00",
        endTime: null,
        note: "181",
      }),
    ).toEqual({ shiftId: 2, startTime: "18:00", endTime: "", note: "181" });
  });
});

describe("validate", () => {
  it("accepts a shift with its own times", () => {
    expect(validate(valid, shifts)).toEqual({});
  });

  it("asks for a shift", () => {
    expect(validate({ ...valid, shiftId: null }, shifts)).toEqual({ shiftId: "Choose a shift." });
  });

  it("asks for a shift when the picked one no longer exists", () => {
    expect(validate({ ...valid, shiftId: 9 }, shifts).shiftId).toBe("Choose a shift.");
  });

  it("rejects a day that starts and ends at the same time", () => {
    const same = "The shift can't start and end at the same time.";
    // Spät ab 00:00: starts when the shift ends.
    expect(validate({ ...valid, startTime: "00:00" }, shifts).endTime).toBe(same);
    // Früh bis 08:00: ends when the shift starts.
    expect(validate({ ...valid, shiftId: 1, endTime: "08:00" }, shifts).endTime).toBe(same);
    expect(validate({ ...valid, startTime: "12:00", endTime: "12:00" }, shifts).endTime).toBe(same);
  });

  it("accepts a late shift that ends after midnight", () => {
    expect(validate({ ...valid, startTime: "18:00", endTime: "02:00" }, shifts)).toEqual({});
  });

  it("allows notes of up to 100 characters, not counting spaces around them", () => {
    expect(validate({ ...valid, note: ` ${"a".repeat(100)} ` }, shifts)).toEqual({});
    expect(validate({ ...valid, note: "a".repeat(101) }, shifts).note).toBe("Use at most 100 characters.");
  });
});

describe("toInput", () => {
  it("sends empty times and an empty note as null", () => {
    expect(toInput({ ...valid, note: "   " })).toEqual({
      shiftId: 2,
      startTime: null,
      endTime: null,
      note: null,
    });
  });

  it("sends changed times and the trimmed note", () => {
    expect(toInput({ shiftId: 2, startTime: "18:00", endTime: "23:00", note: " 181 " })).toEqual({
      shiftId: 2,
      startTime: "18:00",
      endTime: "23:00",
      note: "181",
    });
  });
});

describe("fromHint", () => {
  it("starts with the hint's shift picked and the rest empty", () => {
    expect(fromHint(1)).toEqual({ shiftId: 1, startTime: "", endTime: "", note: "" });
  });
});

describe("isHintAsIs", () => {
  it("is true for the hint's shift without changes", () => {
    expect(isHintAsIs(fromHint(1), 1)).toBe(true);
    expect(isHintAsIs({ ...fromHint(1), note: "   " }, 1)).toBe(true);
  });

  it("is false once the shift, a time or the note is changed", () => {
    expect(isHintAsIs({ ...fromHint(1), shiftId: 2 }, 1)).toBe(false);
    expect(isHintAsIs({ ...fromHint(1), shiftId: null }, 1)).toBe(false);
    expect(isHintAsIs({ ...fromHint(1), startTime: "12:00" }, 1)).toBe(false);
    expect(isHintAsIs({ ...fromHint(1), endTime: "15:00" }, 1)).toBe(false);
    expect(isHintAsIs({ ...fromHint(1), note: "181" }, 1)).toBe(false);
  });
});
