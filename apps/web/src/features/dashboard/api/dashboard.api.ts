import type { DashboardSummary } from "@lead-saas/shared-types";

import { apiClient } from "../../../services/api-client";

type DashboardSummaryResponse = {
  success: true;
  message?: string;
  data: {
    summary: DashboardSummary;
  };
};

export const getDashboardSummary = async (): Promise<DashboardSummary> => {
  const response =
    await apiClient.get<DashboardSummaryResponse>("/dashboard/summary");
  return response.data.data.summary;
};
