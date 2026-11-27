/**
 * One cell of a schedule as the API returns it (backend: entryColumns): one
 * employee working one shift on one day.
 */
export type ScheduleEntry = {
  id: number;
  /** The employee (Employee.id): the same person in every restaurant they work in. */
  employeeId: number;
  /** "YYYY-MM-DD". */
  workDate: string;
  /** One of the owner's shifts (Shift.id); the restaurant's times for it are in its shiftTimes. */
  shiftId: number;
  /** "HH:MM" when this cell starts at another time than its shift ("Spät ab 18:00"), else null. */
  startTime: string | null;
  /** "HH:MM" when this cell ends at another time than its shift ("Früh bis 14:00"), else null. */
  endTime: string | null;
  note: string | null;
};

/**
 * One person's availability for the week (backend: getSchedule →
 * availability): the shift they can work on each day, as a hint in the
 * schedule, and their note. Only active people whose default restaurant this
 * is; the owner never changes it.
 */
export type AvailabilityHint = {
  /** The employee (Employee.id). */
  employeeId: number;
  /** One note for the whole week, or null. */
  note: string | null;
  /**
   * The days not dismissed, sorted. Empty for someone who can't work at all
   * that week. A day that already has a cell here is included too: the cell
   * wins, and clearing it brings the hint back.
   */
  days: { date: string; shiftId: number }[];
};

/**
 * One restaurant's week (GET /schedules). A week nobody has planned yet comes
 * back with no entries.
 */
export type Schedule = {
  restaurantId: number;
  /** The week's Monday, "YYYY-MM-DD". */
  weekStart: string;
  /** Sorted by day. */
  entries: ScheduleEntry[];
  /** Sorted by employee id. */
  availability: AvailabilityHint[];
};

/** Body of POST /availability/dismiss: one day's hint, hidden without a shift. */
export type DismissAvailabilityInput = {
  employeeId: number;
  /** "YYYY-MM-DD". */
  date: string;
};

/**
 * Body of POST /schedules/entries: one employee's shift on one day. A null
 * time is the shift's own time; a null note is no note.
 */
export type CreateEntryInput = {
  employeeId: number;
  /** The restaurant whose week the cell is in; the employee must work there. */
  restaurantId: number;
  /** "YYYY-MM-DD". */
  workDate: string;
  shiftId: number;
  /** "HH:MM", or null for the shift's own start. */
  startTime: string | null;
  /** "HH:MM", or null for the shift's own end. */
  endTime: string | null;
  note: string | null;
};

/**
 * Body of PUT /schedules/entries/:id. Replaces the cell, so every field is
 * sent again; the cell stays with its employee and day.
 */
export type EditEntryInput = Pick<CreateEntryInput, "shiftId" | "startTime" | "endTime" | "note">;
