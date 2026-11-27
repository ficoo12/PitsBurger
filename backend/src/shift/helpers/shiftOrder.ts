import { asc, sql } from "drizzle-orm";
import { shift } from "../../db/schema.js";

// Shifts are listed by their default start time, then end time. A shift that
// ends after midnight ends later than any shift that ends the same day.
export const shiftOrder = [
  asc(shift.startTime),
  asc(sql`${shift.endTime} < ${shift.startTime}`),
  asc(shift.endTime),
  asc(shift.id),
];
