import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionQuery } from "./useCurrentUser";
import { login } from "./login";

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: (user) => queryClient.setQueryData(sessionQuery.queryKey, user),
  });
}
