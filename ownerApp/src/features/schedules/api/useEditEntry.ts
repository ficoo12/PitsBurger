import { useMutation } from "@tanstack/react-query";
import { putEntry } from "../scheduleCache";
import type { EditEntryInput } from "../types";
import { editEntry } from "./editEntry";
import { useEntryCache } from "./useEntryCache";

/** Replaces the shift in a saved cell of one restaurant's week. */
export function useEditEntry(restaurantId: number, weekStart: string) {
  const cache = useEntryCache(restaurantId, weekStart);
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: EditEntryInput }) => editEntry(id, input),
    onSuccess: (entry) => cache.update((schedule) => putEntry(schedule, entry)),
    onError: cache.refetchIfStale,
  });
}
