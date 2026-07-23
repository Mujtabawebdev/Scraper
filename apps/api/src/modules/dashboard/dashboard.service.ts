import type { DashboardSummary } from "@lead-saas/shared-types";

import { getOwnedDashboardCounts } from "./dashboard.repository.js";

export const getDashboardSummary = async (
  userId: string,
): Promise<DashboardSummary> => getOwnedDashboardCounts(userId);
