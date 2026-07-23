import { useMutation, useQueryClient } from "@tanstack/react-query";

import { clearUserServerState } from "../../../app/clear-server-state";
import { useAppDispatch } from "../../../app/store";
import { logoutAll } from "../api/auth.api";
import { clearAuth } from "../store/auth.slice";

export const useLogoutAll = () => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logoutAll,
    onSettled: () => {
      dispatch(clearAuth());
      clearUserServerState(queryClient);
    },
  });
};
