import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPosition } from "./createPosition";
import { positionsQuery } from "./useGetPositions";

export function useCreatePosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createPosition,
    onSuccess: (position) => {
      // The list is sorted by name, so the new position is put in its place
      // right away. If the list hasn't been loaded yet there is nothing to
      // update: it loads fresh later.
      queryClient.setQueryData(positionsQuery.queryKey, (list) =>
        list ? [...list, position].sort((a, b) => a.name.localeCompare(b.name)) : list,
      );
      // The server has the last word on the order: the list is fetched again
      // the next time it is shown.
      return queryClient.invalidateQueries({ queryKey: positionsQuery.queryKey });
    },
  });
}
