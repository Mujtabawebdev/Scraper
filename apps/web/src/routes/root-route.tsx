import { Navigate } from "react-router-dom";

import { useAppSelector } from "../app/store";
import { PageLoader } from "../components/feedback/page-loader";
import {
  selectIsAuthenticated,
  selectIsAuthInitializing,
} from "../features/auth/store/auth.slice";

export function RootRoute() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated);
  const isInitializing = useAppSelector(selectIsAuthInitializing);

  if (isInitializing) {
    return <PageLoader message="Restoring your session..." />;
  }

  return (
    <Navigate replace to={isAuthenticated ? "/dashboard" : "/login"} />
  );
}
