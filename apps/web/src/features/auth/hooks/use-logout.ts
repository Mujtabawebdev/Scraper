import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAppDispatch } from "../../../app/store";
import { logout } from "../api/auth.api";
import { authQueryKeys } from "../api/auth-query-keys";
import { clearAuth } from "../store/auth.slice";

export const useLogout = () => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSettled: async () => {
      dispatch(clearAuth());
      await queryClient.cancelQueries({ queryKey: authQueryKeys.all });
      queryClient.removeQueries({ queryKey: authQueryKeys.all });
    },
  });
};
