import { useQuery } from "@tanstack/react-query";

import { getDashboardSummary } from "../api/dashboard.api";
import { dashboardQueryKeys } from "../api/dashboard-query-keys";

export const useDashboardSummary = () =>
  useQuery({
    queryKey: dashboardQueryKeys.summary(),
    queryFn: getDashboardSummary,
  });
