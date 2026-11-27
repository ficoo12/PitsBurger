import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "../../../lib/apiClient";
import { submitAvailability } from "./submitAvailability";
import { availabilityQuery } from "./useAvailability";

export function useSubmitAvailability() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitAvailability,
    onSuccess: (saved) => {
      // The screen shows the saved week at once, then checks with the server.
      queryClient.setQueryData(availabilityQuery.queryKey, (week) =>
        week && week.weekStart === saved.weekStart
          ? {
              ...week,
              savesLeft: saved.savesLeft,
              submission: { note: saved.note, days: saved.days },
            }
          : week,
      );
      return queryClient.invalidateQueries({ queryKey: availabilityQuery.queryKey });
    },
    onError: (error) => {
      // 409: the window closed or no saves are left. The screen is out of
      // date, so it reloads and turns read-only.
      if (error instanceof ApiError && error.status === 409) {
        return queryClient.invalidateQueries({ queryKey: availabilityQuery.queryKey });
      }
    },
  });
}
