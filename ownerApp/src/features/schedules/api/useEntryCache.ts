import { useQueryClient } from "@tanstack/react-query";
import { toApiError } from "../../../lib/apiClient";
import type { Schedule } from "../types";
import { scheduleQuery } from "./useGetSchedule";

/**
 * What the cell mutations share: they write their answer into the shown
 * week's schedule, so the table changes without asking for the week again.
 * A 404 or 409 means the cells changed elsewhere (another tab, another
 * owner session), so then the week is fetched again.
 */
export function useEntryCache(restaurantId: number, weekStart: string) {
  const queryClient = useQueryClient();
  const { queryKey } = scheduleQuery(restaurantId, weekStart);
  return {
    update: (change: (schedule: Schedule) => Schedule) =>
      queryClient.setQueryData(queryKey, (old) => (old ? change(old) : old)),
    refetchIfStale: (error: unknown) => {
      const { status } = toApiError(error);
      if (status === 404 || status === 409) void queryClient.invalidateQueries({ queryKey });
    },
  };
}
