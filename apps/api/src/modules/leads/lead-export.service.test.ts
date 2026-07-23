import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./lead.repository.js", () => ({
  listOwnedLeadsForExport: vi.fn(),
}));

import {
  LEAD_EXPORT_ROW_LIMIT,
  escapeCsvCell,
  exportLeadsCsv,
} from "./lead-export.service.js";
import {
  listOwnedLeadsForExport,
  type LeadDetailRecord,
} from "./lead.repository.js";

const record: LeadDetailRecord = {
  id: "00000000-0000-4000-8000-000000000001",
  businessName: '=HYPERLINK("https://evil.test")',
  phoneRaw: "+12025550101",
  email: "hello@example.test",
  website: "https://example.test/",
  category: "Plumbing",
  addressLine1: '123 "Main" Street',
  addressLine2: null,
  city: "Austin",
  state: "TX",
  postalCode: "78701",
  country: "United States",
  sourceUrl: "fixture://business/1",
  scrapingJobId: "00000000-0000-4000-8000-000000000002",
  createdAt: new Date("2026-07-23T12:00:00.000Z"),
  updatedAt: new Date("2026-07-23T12:00:00.000Z"),
  scrapingJob: { source: "fixture-business-directory" },
};

describe("escapeCsvCell", () => {
  it("quotes values, escapes quotes, and prevents spreadsheet formulas", () => {
    expect(escapeCsvCell('A "quoted" value')).toBe('"A ""quoted"" value"');
    expect(escapeCsvCell("=1+1")).toBe('"\'=1+1"');
    expect(escapeCsvCell("  @SUM(A1:A2)")).toBe('"\'  @SUM(A1:A2)"');
    expect(escapeCsvCell("\t=1+1")).toBe('"\'\t=1+1"');
    expect(escapeCsvCell("+12025550101")).toBe('"\'+12025550101"');
  });
});

describe("exportLeadsCsv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes tenant ownership to the repository and emits a UTF-8-safe CSV", async () => {
    vi.mocked(listOwnedLeadsForExport).mockResolvedValue([record]);

    const csv = await exportLeadsCsv("user-1", {
      search: "Austin",
      sortBy: "createdAt",
      sortOrder: "desc",
    });

    expect(listOwnedLeadsForExport).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ search: "Austin" }),
      LEAD_EXPORT_ROW_LIMIT + 1,
    );
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain('"Business Name"');
    expect(csv).toContain('"\'=HYPERLINK(""https://evil.test"")"');
    expect(csv).toContain('"123 ""Main"" Street"');
  });

  it("rejects a synchronous export above the safe row limit", async () => {
    vi.mocked(listOwnedLeadsForExport).mockResolvedValue(
      Array.from({ length: LEAD_EXPORT_ROW_LIMIT + 1 }, () => record),
    );

    await expect(
      exportLeadsCsv("user-1", {
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
    ).rejects.toMatchObject({
      code: "EXPORT_LIMIT_EXCEEDED",
      statusCode: 422,
      message:
        "CSV export is limited to 10000 matching leads; narrow the filters and try again. Asynchronous export will be added later.",
    });
  });
});
