import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAppDispatch } from "../../../app/store";
import { normalizeApiError } from "../../../services/api-client";
import { getCurrentUser, logout, register } from "../api/auth.api";
import { authQueryKeys } from "../api/auth-query-keys";
import type { RegisterFormValues } from "../schemas/auth.schemas";
import { clearAuth, setCredentials, setUser } from "../store/auth.slice";

export const useRegister = () => {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      confirmPassword: _confirmPassword,
      ...registration
    }: RegisterFormValues) => {
      const authentication = await register(registration);
      dispatch(
        setCredentials({
          accessToken: authentication.accessToken,
          user: authentication.user,
        }),
      );

      try {
        const user = await getCurrentUser();
        dispatch(setUser(user));
        queryClient.setQueryData(authQueryKeys.currentUser(), user);
        return user;
      } catch (error: unknown) {
        const apiError = normalizeApiError(error);
        if (apiError.status === 401 || apiError.status === 403) {
          await logout().catch(() => undefined);
          dispatch(clearAuth());
          throw apiError;
        }
        return authentication.user;
      }
    },
  });
};
