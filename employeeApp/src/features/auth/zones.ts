import type { User } from "./types";

/** Which part of the app a visitor may use. */
export type Zone = "guest" | "employee";

export function zoneOf(user: User | null): Zone {
  // GET /employees/me only ever returns employees (requireEmployee).
  return user ? "employee" : "guest";
}

/** Each zone's start page. Guards send visitors here when they open a page outside their zone. */
export const zoneHome: Record<Zone, string> = {
  guest: "/",
  employee: "/availability",
};
