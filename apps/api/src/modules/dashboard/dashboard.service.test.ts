import { describe, expect, it, vi } from "vitest";

vi.mock("./dashboard.repository.js", () => ({
  getOwnedDashboardCounts: vi.fn(),
}));

import { getOwnedDashboardCounts } from "./dashboard.repository.js";
import { getDashboardSummary } from "./dashboard.service.js";

describe("getDashboardSummary", () => {
  it("delegates all summary aggregation to the authenticated tenant scope", async () => {
    vi.mocked(getOwnedDashboardCounts).mockResolvedValue({
      totalJobs: 8,
      activeJobs: 2,
      completedJobs: 4,
      failedJobs: 2,
      totalLeads: 40,
      leadsWithPhone: 30,
      leadsWithEmail: 20,
    });

    const result = await getDashboardSummary("user-1");

    expect(getOwnedDashboardCounts).toHaveBeenCalledWith("user-1");
    expect(result).toMatchObject({ totalJobs: 8, totalLeads: 40 });
  });
});
