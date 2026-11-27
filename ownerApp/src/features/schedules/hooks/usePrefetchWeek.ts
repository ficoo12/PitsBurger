import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import type { Restaurant } from "../../restaurants";
import { scheduleQuery } from "../api/useGetSchedule";

/**
 * Loads every restaurant's schedule for `weekStart` into the cache in the
 * background, so the next-week arrow shows it at once.
 */
export function usePrefetchWeek(restaurants: Restaurant[] | undefined, weekStart: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    for (const restaurant of restaurants ?? []) {
      void queryClient.prefetchQuery(scheduleQuery(restaurant.id, weekStart));
    }
  }, [queryClient, restaurants, weekStart]);
}
