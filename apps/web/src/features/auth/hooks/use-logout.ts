import { useMutation, useQueryClient } from "@tanstack/react-query";

import { clearUserServerState } from "../../../app/clear-server-state";
import { useAppDispatch } from "../../../app/store";
import { logout } from "../api/auth.api";
import { clearAuth } from "../store/auth.slice";

export const useLogout = () => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      dispatch(clearAuth());
      clearUserServerState(queryClient);
    },
  });
};
