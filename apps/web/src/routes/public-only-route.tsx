import { Navigate, Outlet } from "react-router-dom";

import { useAppSelector } from "../app/store";
import { PageLoader } from "../components/feedback/page-loader";
import {
  selectIsAuthenticated,
  selectIsAuthInitializing,
} from "../features/auth/store/auth.slice";

export function PublicOnlyRoute() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isInitializing = useAppSelector(selectIsAuthInitializing);

  if (isInitializing) {
    return <PageLoader message="Restoring your session..." />;
  }

  return isAuthenticated ? <Navigate replace to="/dashboard" /> : <Outlet />;
}
