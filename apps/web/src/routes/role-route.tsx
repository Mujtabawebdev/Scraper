import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAppSelector } from "../app/store";
import { PageLoader } from "../components/feedback/page-loader";
import {
  selectCurrentUser,
  selectIsAuthenticated,
  selectIsAuthInitializing,
} from "../features/auth/store/auth.slice";
import type { UserRole } from "../features/auth/types/auth.types";

export interface RoleRouteProps {
  allowedRoles: readonly UserRole[];
}

export function RoleRoute({ allowedRoles }: RoleRouteProps) {
  const location = useLocation();
  const currentUser = useAppSelector(selectCurrentUser);
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isInitializing = useAppSelector(selectIsAuthInitializing);

  if (isInitializing) {
    return <PageLoader message="Checking your permissions..." />;
  }

  if (!isAuthenticated || currentUser === null) {
    const attemptedPath =
      location.pathname.startsWith("/") && !location.pathname.startsWith("//")
        ? `${location.pathname}${location.search}${location.hash}`
        : "/dashboard";

    return (
      <Navigate replace state={{ from: attemptedPath }} to="/login" />
    );
  }

  return allowedRoles.includes(currentUser.role) ? (
    <Outlet />
  ) : (
    <Navigate replace to="/unauthorized" />
  );
}
