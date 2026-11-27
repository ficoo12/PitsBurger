import { useMutation } from "@tanstack/react-query";
import { dropHint } from "../scheduleCache";
import { dismissAvailability } from "./dismissAvailability";
import { useEntryCache } from "./useEntryCache";

/**
 * Hides one day's availability hint in one restaurant's week. A 404 (already
 * gone, e.g. the employee changed their days) loads the week again.
 */
export function useDismissAvailability(restaurantId: number, weekStart: string) {
  const cache = useEntryCache(restaurantId, weekStart);
  return useMutation({
    mutationFn: dismissAvailability,
    onSuccess: (_, { employeeId, date }) =>
      cache.update((schedule) => dropHint(schedule, employeeId, date)),
    onError: cache.refetchIfStale,
  });
}
