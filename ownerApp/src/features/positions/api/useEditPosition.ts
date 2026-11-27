import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { EditPositionInput } from "../types";
import { editPosition } from "./editPosition";
import { employeesKey } from "./employeesKey";
import { positionsQuery } from "./useGetPositions";

export function useEditPosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: EditPositionInput }) =>
      editPosition(id, input),
    onSuccess: (position) => {
      // Swap the edited position into the cached list. A new name can move it,
      // so the list is sorted by name again. If the list hasn't been loaded
      // yet there is nothing to update: it loads fresh later.
      queryClient.setQueryData(positionsQuery.queryKey, (list) =>
        list
          ?.map((item) => (item.id === position.id ? position : item))
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
      // The server has the last word on the order, and employee lists show
      // the old name: both are fetched again the next time they are shown.
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: positionsQuery.queryKey }),
        queryClient.invalidateQueries({ queryKey: employeesKey }),
      ]);
    },
  });
}
