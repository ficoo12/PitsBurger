import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clearSession } from "./clearSession";
import { logout } from "./logout";

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => clearSession(queryClient),
  });
}
