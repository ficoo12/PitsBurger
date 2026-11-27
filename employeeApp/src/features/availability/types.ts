/** One picked day: the shift the employee can work (backend: submitAvailabilitySchema). */
export type AvailabilityDay = {
  /** ISO weekday: 1 = Monday ... 7 = Sunday. */
  weekday: number;
  shiftId: number;
};

/** When employees can submit, in Berlin time (backend: AvailabilityWindow). */
export type AvailabilityWindow = {
  opensWeekday: number;
  /** "HH:MM". */
  opensTime: string;
  closesWeekday: number;
  /** "HH:MM", the closing minute still counts. */
  closesTime: string;
};

/** What the employee saved for the shown week. */
export type AvailabilitySubmission = {
  note: string | null;
  days: AvailabilityDay[];
};

/** The availability screen as GET /api/availability returns it (backend: getAvailability). */
export type AvailabilityWeek = {
  /** Monday of the shown week, "YYYY-MM-DD". */
  weekStart: string;
  /** Whether the employee can save right now. */
  isOpen: boolean;
  window: AvailabilityWindow;
  /** When the window opens next (Berlin date and time); null while it is open. */
  nextOpening: { date: string; time: string } | null;
  maxSaves: number;
  /** Never negative. */
  savesLeft: number;
  /** The employee's default restaurant. */
  restaurant: { id: number; name: string };
  /** The days the default restaurant is open in the shown week. */
  days: { weekday: number; date: string }[];
  /** The owner's shifts, names only, in their default order. */
  shifts: { id: number; name: string }[];
  /** Null until the employee saved this week. */
  submission: AvailabilitySubmission | null;
};

/** The body of POST /api/availability. A missing day means not available. */
export type SubmitAvailabilityInput = {
  days: AvailabilityDay[];
  note: string | null;
};

/** What POST /api/availability returns (backend: submitAvailability). */
export type SubmittedAvailability = {
  weekStart: string;
  note: string | null;
  days: AvailabilityDay[];
  savesLeft: number;
};
