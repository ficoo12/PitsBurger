import {
  useQueryClient,
  type MutationCacheNotifyEvent,
  type QueryCacheNotifyEvent,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { ApiError } from "../../../lib/apiClient";
import { clearSession } from "../api/clearSession";
import { sessionQuery } from "../api/useCurrentUser";

/**
 * Signs the user out in the app when the server says the session is gone.
 *
 * The session is only asked for once (see sessionQuery), so without this an
 * expired or revoked session would leave the employee on their page with
 * "Not signed in" errors. Any request that answers 401 while someone is signed
 * in clears the session, and the Guard then sends them to the login page.
 */
export function useSessionExpiry() {
  const queryClient = useQueryClient();

  useEffect(() => {
    function onEvent(event: QueryCacheNotifyEvent | MutationCacheNotifyEvent) {
      if (event.type !== "updated" || event.action.type !== "error") return;
      const { error } = event.action;
      if (!(error instanceof ApiError) || error.status !== 401) return;
      // A guest's 401 (e.g. a wrong password on login) is not an expired session.
      if (queryClient.getQueryData(sessionQuery.queryKey)) clearSession(queryClient);
    }

    const stopQueries = queryClient.getQueryCache().subscribe(onEvent);
    const stopMutations = queryClient.getMutationCache().subscribe(onEvent);
    return () => {
      stopQueries();
      stopMutations();
    };
  }, [queryClient]);
}
