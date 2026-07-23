import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, type ReactNode } from "react";

import { useAppDispatch, useAppSelector } from "../../../app/store";
import { PageLoader } from "../../../components/feedback/page-loader";
import { refreshAccessToken } from "../../../services/api-client";
import { getCurrentUser } from "../api/auth.api";
import { authQueryKeys } from "../api/auth-query-keys";
import { clearAuth, setInitializing, setUser } from "../store/auth.slice";

export interface AuthInitializerProps {
  children: ReactNode;
}

export function AuthInitializer({ children }: AuthInitializerProps) {
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const isInitializing = useAppSelector((state) => state.auth.isInitializing);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) {
      return;
    }
    hasStarted.current = true;

    const initializeAuthentication = async () => {
      dispatch(setInitializing(true));
      try {
        if (!accessToken) {
          await refreshAccessToken();
        }
        const user = await getCurrentUser();
        queryClient.setQueryData(authQueryKeys.currentUser(), user);
        dispatch(setUser(user));
      } catch {
        dispatch(clearAuth());
        queryClient.removeQueries({ queryKey: authQueryKeys.all });
      } finally {
        dispatch(setInitializing(false));
      }
    };

    void initializeAuthentication();
  }, [accessToken, dispatch, queryClient]);

  if (isInitializing) {
    return <PageLoader message="Restoring your secure session..." />;
  }

  return children;
}
