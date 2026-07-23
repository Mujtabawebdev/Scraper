import type { AvailableSource } from "@lead-saas/shared-types";

import { apiClient } from "../../../services/api-client";

type SourceResponse = {
  success: true;
  data: { sources: AvailableSource[] };
};

export const fetchAvailableSources = async (): Promise<AvailableSource[]> => {
  const response = await apiClient.get<SourceResponse>("/sources/available");
  return response.data.data.sources;
};
