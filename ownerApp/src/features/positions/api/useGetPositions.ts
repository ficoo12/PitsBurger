import { queryOptions, useQuery } from "@tanstack/react-query";
import { getPositions } from "./getPositions";

/**
 * The owner's positions, shared by all their restaurants. Mutations that
 * create, edit or delete a position update or invalidate this through `positionsQuery.queryKey`.
 */
export const positionsQuery = queryOptions({
  queryKey: ["positions"],
  queryFn: getPositions,
});

export function useGetPositions() {
  return useQuery(positionsQuery);
}
