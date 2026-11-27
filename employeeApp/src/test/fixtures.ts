import type { User } from "../features/auth/types";
import type { AvailabilityWeek } from "../features/availability";

/** A signed-in employee. Spread it to change single fields: `{ ...testEmployee, firstName: "Mia" }`. */
export const testEmployee: User = {
  id: 70,
  email: "jonas@example.com",
  firstName: "Jonas",
  lastName: "Becker",
  username: "jonas.becker",
  role: "employee",
  avatarUrl: null,
  createdAt: "2026-11-07T21:48:43.781Z",
};

/**
 * Next week's availability screen while the window is open and nothing is
 * saved yet: open Monday to Saturday, the shifts Früh and Spät, 3 saves.
 */
export const testAvailabilityWeek: AvailabilityWeek = {
  weekStart: "2026-11-30",
  isOpen: true,
  window: { opensWeekday: 5, opensTime: "00:00", closesWeekday: 7, closesTime: "23:59" },
  nextOpening: null,
  maxSaves: 3,
  savesLeft: 3,
  restaurant: { id: 4, name: "Riverside" },
  days: [1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    date: `2026-${weekday === 1 ? "11-30" : `12-0${weekday - 1}`}`,
  })),
  shifts: [
    { id: 7, name: "Früh" },
    { id: 8, name: "Spät" },
  ],
  submission: null,
};
