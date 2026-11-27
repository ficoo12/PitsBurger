import { z } from "zod";

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the format HH:MM");

// An id sent in the JSON body. 15 digits always fit a JS number exactly.
const id = z.int().positive().max(999_999_999_999_999);

// An id in the URL or the query string. Plain digits only, so every cell has
// exactly one URL: "1e2", "0x1F", " 12" and "012" are not ids.
const idParam = z
  .string()
  .regex(/^[1-9]\d{0,14}$/)
  .transform(Number);

// A calendar date as YYYY-MM-DD. The round trip through Date rejects days
// that don't exist, e.g. 2025-02-30.
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine(
    (v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
    },
    { message: "This date does not exist" }
  );

// A schedule week runs from Monday to Sunday. An invalid date already has its
// own error above, so it isn't reported a second time here.
const weekStart = isoDate.refine(
  (v) => {
    const d = new Date(`${v}T00:00:00Z`);
    return Number.isNaN(d.getTime()) || d.getUTCDay() === 1;
  },
  { message: "The week must start on a Monday" }
);

// Always one restaurant and week: ?restaurantId=3&weekStart=2026-10-05
export const getScheduleSchema = z.object({
  restaurantId: idParam,
  weekStart,
});

// Trimmed; an empty note is saved as no note.
const note = z
  .string()
  .trim()
  .max(100)
  .transform((v) => (v === "" ? null : v));

// restaurantId is one of the restaurants the employee works in. shiftId is
// one of the owner's shifts; the restaurant has to have it.
// startTime / endTime change the shift's usual times for this one cell
// ("Spät ab 18" = startTime 18:00); null or missing = the shift's own time.
// z.object strips unknown keys, so the helper columns can't be sent.
export const createEntrySchema = z.object({
  employeeId: id,
  restaurantId: id,
  workDate: isoDate,
  shiftId: id,
  startTime: time.nullable().optional(),
  endTime: time.nullable().optional(),
  note: note.nullable().optional(),
});

// PUT replaces the cell, so every field is required again; the ones that can
// be empty are sent as null. A cell stays with its employee, restaurant and
// day, so an employeeId, restaurantId or workDate in the body is dropped.
export const updateEntrySchema = z.object({
  shiftId: id,
  startTime: time.nullable(),
  endTime: time.nullable(),
  note: note.nullable(),
});

export const entryIdSchema = z.object({ id: idParam });

export type CreateEntryInput = z.infer<typeof createEntrySchema>;
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>;
