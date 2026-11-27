import type { QueryClient } from "@tanstack/react-query";
import { sessionQuery } from "./useCurrentUser";

/**
 * Makes the visitor a guest and throws away everything the previous user
 * loaded, so the next person on this browser never sees it. Auth queries stay.
 */
export function clearSession(queryClient: QueryClient) {
  queryClient.setQueryData(sessionQuery.queryKey, null);
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== "auth" });
}
