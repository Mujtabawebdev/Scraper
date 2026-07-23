import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAppDispatch } from "../../../app/store";
import { logoutAll } from "../api/auth.api";
import { authQueryKeys } from "../api/auth-query-keys";
import { clearAuth } from "../store/auth.slice";

export const useLogoutAll = () => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutAll,
    onSettled: async () => {
      dispatch(clearAuth());
      await queryClient.cancelQueries({ queryKey: authQueryKeys.all });
      queryClient.removeQueries({ queryKey: authQueryKeys.all });
    },
  });
};
