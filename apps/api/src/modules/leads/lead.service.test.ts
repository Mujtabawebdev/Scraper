import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lead.repository.js", () => ({
  findOwnedLeadDetail: vi.fn(),
  listOwnedLeads: vi.fn(),
}));

import {
  findOwnedLeadDetail,
  listOwnedLeads,
  type LeadDetailRecord,
  type LeadSummaryRecord,
} from "./lead.repository.js";
import { getLead, listLeads } from "./lead.service.js";

const createdAt = new Date("2026-07-23T12:00:00.000Z");

const summaryRecord: LeadSummaryRecord = {
  id: "00000000-0000-4000-8000-000000000001",
  businessName: "Example Plumbing",
  phoneRaw: "+12025550101",
  email: "hello@example.test",
  website: "https://example.test/",
  category: "Plumbing",
  city: "Austin",
  state: "TX",
  createdAt,
  scrapingJob: { source: "fixture-business-directory" },
};

const detailRecord: LeadDetailRecord = {
  ...summaryRecord,
  addressLine1: "123 Main Street",
  addressLine2: "Suite 4",
  postalCode: "78701",
  country: "United States",
  sourceUrl: "fixture://business/1",
  scrapingJobId: "00000000-0000-4000-8000-000000000002",
  updatedAt: createdAt,
};

describe("lead service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes the authenticated tenant into paginated listing", async () => {
    vi.mocked(listOwnedLeads).mockResolvedValue({
      leads: [summaryRecord],
      totalItems: 26,
    });
    const query = {
      page: 2,
      pageSize: 25,
      sortBy: "createdAt",
      sortOrder: "desc",
    } as const;

    const result = await listLeads("user-1", query);

    expect(listOwnedLeads).toHaveBeenCalledWith("user-1", query);
    expect(result.leads[0]).toMatchObject({
      businessName: "Example Plumbing",
      source: "fixture-business-directory",
    });
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 25,
      totalItems: 26,
      totalPages: 2,
      hasNextPage: false,
      hasPreviousPage: true,
    });
  });

  it("maps only safe lead detail fields", async () => {
    vi.mocked(findOwnedLeadDetail).mockResolvedValue(detailRecord);

    const result = await getLead("user-1", detailRecord.id);

    expect(findOwnedLeadDetail).toHaveBeenCalledWith(detailRecord.id, "user-1");
    expect(result).toMatchObject({
      phone: "+12025550101",
      address: "123 Main Street, Suite 4",
      scrapingJobId: detailRecord.scrapingJobId,
    });
    expect(result).not.toHaveProperty("phoneNormalized");
    expect(result).not.toHaveProperty("sourceExternalId");
  });

  it("uses an indistinguishable 404 for missing and cross-tenant leads", async () => {
    vi.mocked(findOwnedLeadDetail).mockResolvedValue(null);

    await expect(getLead("user-1", detailRecord.id)).rejects.toMatchObject({
      code: "LEAD_NOT_FOUND",
      statusCode: 404,
    });
  });
});
