import { useMutation } from "@tanstack/react-query";
import { putEntry } from "../scheduleCache";
import { createEntry } from "./createEntry";
import { useEntryCache } from "./useEntryCache";

/** Saves a shift in an empty cell of one restaurant's week. */
export function useCreateEntry(restaurantId: number, weekStart: string) {
  const cache = useEntryCache(restaurantId, weekStart);
  return useMutation({
    mutationFn: createEntry,
    onSuccess: (entry) => cache.update((schedule) => putEntry(schedule, entry)),
    onError: cache.refetchIfStale,
  });
}
