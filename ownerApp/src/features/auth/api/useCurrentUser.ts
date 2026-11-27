import { queryOptions, useQuery } from "@tanstack/react-query";
import type { User } from "../types";
import { getCurrentUser } from "./getCurrentUser";

/** Who is signed in: the user, or null without a valid session (GET /auth/me). */
export const sessionQuery = queryOptions({
  queryKey: ["auth", "me"],
  queryFn: getCurrentUser,
  // Never refetched on its own: login and logout update it themselves. Any new action that changes the session must too.
  staleTime: Infinity,
});

/**
 * The signed-in user, or null. AuthBootstrap waits for the first answer,
 * so pages below it never see the loading state.
 */
export function useCurrentUser(): User | null {
  return useQuery(sessionQuery).data ?? null;
}
