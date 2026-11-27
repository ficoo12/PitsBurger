import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deletePosition } from "./deletePosition";
import { employeesKey } from "./employeesKey";
import { positionsQuery } from "./useGetPositions";

export function useDeletePosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deletePosition,
    onSuccess: (_data, id) => {
      // Take the deleted position out of the cached list. If the list hasn't
      // been loaded yet there is nothing to update: it loads fresh later.
      queryClient.setQueryData(positionsQuery.queryKey, (list) =>
        list?.filter((position) => position.id !== id),
      );
      // Employees who had the position lose it on the server: their lists
      // are fetched again the next time they are shown.
      return queryClient.invalidateQueries({ queryKey: employeesKey });
    },
  });
}
