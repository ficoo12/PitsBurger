import { z } from "zod";
import { isoDate } from "../schedule/scheduleSchema.js";

// ISO weekday: 1 = Monday ... 7 = Sunday.
const weekday = z.number().int().min(1).max(7);

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use the format HH:MM");

// When employees can submit their availability for next week (Europe/Berlin),
// and how many times they can save it.
// PUT replaces all settings. z.object strips unknown keys, so an `ownerId`
// sent by the client is dropped.
export const updateAvailabilitySettingsSchema = z
  .object({
    opensWeekday: weekday,
    opensTime: time,
    closesWeekday: weekday,
    closesTime: time,
    maxSaves: z.number().int().min(1).max(5),
  })
  // The window stays inside one Monday–Sunday week, so "next week" is never
  // ambiguous while it is open. The same weekday is fine if it closes later.
  // "HH:MM" strings compare correctly as text.
  .refine(
    (s) =>
      s.opensWeekday < s.closesWeekday ||
      (s.opensWeekday === s.closesWeekday && s.opensTime < s.closesTime),
    { message: "The window must close after it opens", path: ["closesTime"] }
  );

export type UpdateAvailabilitySettingsInput = z.infer<
  typeof updateAvailabilitySettingsSchema
>;

const id = z.number().int().positive();

// The days the employee can work next week, each with the shift they picked.
// A missing day means not available; [] = not available all week.
// z.object strips unknown keys, so an employeeId, ownerId or weekStart sent by
// the client is dropped: the person is always the caller and the week is
// always next week.
export const submitAvailabilitySchema = z.object({
  days: z
    .array(z.object({ weekday, shiftId: id }))
    .max(7)
    .refine(
      (days) => new Set(days.map((day) => day.weekday)).size === days.length,
      { message: "Each day can only be picked once" }
    ),
  // Missing, null and "" (also after trimming) all mean no note.
  note: z
    .string()
    .trim()
    .max(100)
    .nullish()
    .transform((note) => note || null),
});

export type SubmitAvailabilityInput = z.infer<typeof submitAvailabilitySchema>;

// The owner hides one day's availability hint in the schedule without giving
// the person a shift. The day is named by the employee and its date, as the
// schedule shows it.
export const dismissAvailabilitySchema = z.object({
  employeeId: id,
  date: isoDate,
});

export type DismissAvailabilityInput = z.infer<
  typeof dismissAvailabilitySchema
>;
