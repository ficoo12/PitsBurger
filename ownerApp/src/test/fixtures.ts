import type { User } from "../features/auth/types";
import type { Employee } from "../features/employees";
import type { Shift } from "../features/shifts";

/** A signed-in owner. Spread it to change single fields: `{ ...testUser, firstName: null }`. */
export const testUser: User = {
  id: 1,
  email: "ana@example.com",
  firstName: "Ana",
  lastName: "Horvat",
  username: null,
  role: "owner",
  avatarUrl: null,
  createdAt: "2026-11-07T21:48:43.781Z",
};

/** An active employee who works only in restaurant 1, as GET /employees returns it. Spread it to change single fields. */
export const testEmployee: Employee = {
  id: 7,
  userId: 70,
  firstName: "Jonas",
  lastName: "Becker",
  email: "jonas@example.com",
  username: "jonas.becker",
  avatarUrl: null,
  dateOfBirth: "1998-03-13",
  contractId: 1,
  status: "active",
  hiredOn: "2026-01-15",
  leftOn: null,
  createdAt: "2026-11-11T22:00:00.000Z",
  updatedAt: "2026-11-11T22:00:00.000Z",
  defaultRestaurantId: 1,
  otherRestaurantIds: [],
  positions: [{ id: 10, name: "Service", colour: "red" }],
};

/** One of the owner's shifts with its default times. */
export const testShift: Shift = {
  id: 20,
  name: "Früh",
  startTime: "11:00",
  endTime: "17:00",
  shade: "early",
};
