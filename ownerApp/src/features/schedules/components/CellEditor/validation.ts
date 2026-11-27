import type { ShiftTime } from "../../../restaurants";
import type { EditEntryInput, ScheduleEntry } from "../../types";

/** The backend's limit for a cell's note. */
export const NOTE_MAX = 100;

export type Values = {
  /** The picked shift, or null while none is picked. */
  shiftId: number | null;
  /** "HH:MM", or "" for the shift's own start. */
  startTime: string;
  /** "HH:MM", or "" for the shift's own end. */
  endTime: string;
  note: string;
};

export type Errors = {
  shiftId?: string;
  startTime?: string;
  endTime?: string;
  note?: string;
};

/** The form values for a cell: empty for a cell without a shift. */
export function fromEntry(entry: ScheduleEntry | undefined): Values {
  return {
    shiftId: entry?.shiftId ?? null,
    startTime: entry?.startTime ?? "",
    endTime: entry?.endTime ?? "",
    note: entry?.note ?? "",
  };
}

/** The form values for an empty cell with an availability hint: its shift picked. */
export function fromHint(shiftId: number): Values {
  return { ...fromEntry(undefined), shiftId };
}

/** Whether the values are the hint's shift as it is: no other shift, times or note. */
export function isHintAsIs(values: Values, shiftId: number): boolean {
  return (
    values.shiftId === shiftId &&
    values.startTime === "" &&
    values.endTime === "" &&
    values.note.trim() === ""
  );
}

export function validate(values: Values, shifts: ShiftTime[]): Errors {
  const errors: Errors = {};
  const shift = shifts.find((item) => item.shiftId === values.shiftId);
  if (!shift) {
    errors.shiftId = "Choose a shift.";
  } else if ((values.startTime || shift.startTime) === (values.endTime || shift.endTime)) {
    errors.endTime = "The shift can't start and end at the same time.";
  }
  if (values.note.trim().length > NOTE_MAX) {
    errors.note = `Use at most ${NOTE_MAX} characters.`;
  }
  return errors;
}

/**
 * The body for valid values. Empty times and an empty note are sent as null;
 * the backend also stores a time equal to the shift's own as null.
 */
export function toInput(values: Values): EditEntryInput {
  if (values.shiftId === null) throw new Error("toInput needs a shift: validate first");
  return {
    shiftId: values.shiftId,
    startTime: values.startTime || null,
    endTime: values.endTime || null,
    note: values.note.trim() || null,
  };
}
