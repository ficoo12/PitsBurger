import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./apiClient";

const MAX_RETRIES = 2;

/** Server state lives in this cache. Zustand is only for client state. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Retry network and server errors, but not 4xx answers: asking again won't change them.
      retry: (failureCount, error) =>
        failureCount < MAX_RETRIES &&
        !(error instanceof ApiError && error.status >= 400 && error.status < 500),
    },
  },
});
