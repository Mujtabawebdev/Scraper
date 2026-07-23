import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAppSelector } from "../app/store";
import { PageLoader } from "../components/feedback/page-loader";
import {
  selectIsAuthenticated,
  selectIsAuthInitializing,
} from "../features/auth/store/auth.slice";

function getSafeReturnPath(
  pathname: string,
  search: string,
  hash: string,
): string {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) {
    return "/dashboard";
  }

  return `${pathname}${search}${hash}`;
}

export function ProtectedRoute() {
  const location = useLocation();
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isInitializing = useAppSelector(selectIsAuthInitializing);

  if (isInitializing) {
    return <PageLoader message="Restoring your session..." />;
  }

  if (!isAuthenticated) {
    const from = getSafeReturnPath(
      location.pathname,
      location.search,
      location.hash,
    );

    return <Navigate replace state={{ from }} to="/login" />;
  }

  return <Outlet />;
}
