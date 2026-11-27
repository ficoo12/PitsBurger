import { useMutation } from "@tanstack/react-query";
import { dropEntry } from "../scheduleCache";
import { deleteEntry } from "./deleteEntry";
import { useEntryCache } from "./useEntryCache";

/** Clears a saved cell of one restaurant's week. */
export function useDeleteEntry(restaurantId: number, weekStart: string) {
  const cache = useEntryCache(restaurantId, weekStart);
  return useMutation({
    mutationFn: deleteEntry,
    onSuccess: (_, id) => cache.update((schedule) => dropEntry(schedule, id)),
    onError: cache.refetchIfStale,
  });
}
