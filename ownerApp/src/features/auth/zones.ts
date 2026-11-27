import type { User } from "./types";

/** Which part of the app a visitor may use. */
export type Zone = "guest" | "signedIn";

/**
 * Only an owner is signed in here. The backend's login only lets owners in,
 * but a session made before that (or any other non-owner) counts as a guest,
 * so it gets the login page instead of a dashboard where every request fails.
 */
export function zoneOf(user: User | null): Zone {
  return user?.role === "owner" ? "signedIn" : "guest";
}

/** Each zone's start page. Guards send visitors here when they open a page outside their zone. */
export const zoneHome: Record<Zone, string> = {
  guest: "/login",
  signedIn: "/dashboard",
};
