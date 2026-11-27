import { queryOptions, useQuery } from "@tanstack/react-query";
import { getSchedule } from "./getSchedule";

/** Every schedule is cached under this key, followed by the restaurant's id and the week's Monday. */
export const schedulesKey = ["schedules"] as const;

/**
 * One restaurant's week. Fresh for 30 seconds, so a week that was just
 * prefetched isn't asked for a second time when the owner moves to it.
 */
export function scheduleQuery(restaurantId: number, weekStart: string) {
  return queryOptions({
    queryKey: [...schedulesKey, restaurantId, weekStart],
    queryFn: () => getSchedule(restaurantId, weekStart),
    staleTime: 30_000,
  });
}

/** One restaurant's week. */
export function useGetSchedule(restaurantId: number, weekStart: string) {
  return useQuery(scheduleQuery(restaurantId, weekStart));
}
