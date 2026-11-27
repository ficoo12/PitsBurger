import { queryOptions, useQuery } from "@tanstack/react-query";
import { getAvailability } from "./getAvailability";

/** The availability screen (GET /availability). Logout clears it with the rest of the cache. */
export const availabilityQuery = queryOptions({
  queryKey: ["availability"],
  queryFn: getAvailability,
});

export function useAvailability() {
  return useQuery(availabilityQuery);
}
