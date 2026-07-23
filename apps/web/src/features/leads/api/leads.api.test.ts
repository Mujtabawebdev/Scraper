import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LeadListFilters } from "../types/lead.types";
import { exportLeadsCsv } from "./leads.api";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

vi.mock("../../../services/api-client", () => ({
  apiClient: {
    get: apiMocks.get,
  },
}));

const filters: LeadListFilters = {
  page: 3,
  pageSize: 50,
  search: "plumbers",
  state: "TX",
  hasEmail: true,
  sortBy: "createdAt",
  sortOrder: "desc",
};

describe("exportLeadsCsv", () => {
  beforeEach(() => {
    apiMocks.get.mockReset();
    apiMocks.get.mockResolvedValue({
      data: new Blob(["Business Name\nExample"]),
      headers: {
        "content-disposition": 'attachment; filename="filtered-leads.csv"',
      },
    });
  });

  it("exports current filters without pagination or credentials in the URL", async () => {
    const exported = await exportLeadsCsv(filters);

    expect(exported.filename).toBe("filtered-leads.csv");
    expect(apiMocks.get).toHaveBeenCalledOnce();
    const [path, options] = apiMocks.get.mock.calls[0] as [
      string,
      { params: URLSearchParams; responseType: string },
    ];
    expect(path).toBe("/leads/export.csv");
    expect(options.responseType).toBe("blob");
    expect(options.params.get("search")).toBe("plumbers");
    expect(options.params.get("state")).toBe("TX");
    expect(options.params.get("hasEmail")).toBe("true");
    expect(options.params.get("page")).toBeNull();
    expect(options.params.get("pageSize")).toBeNull();
    expect(options.params.toString()).not.toMatch(/token|authorization/i);
  });
});
