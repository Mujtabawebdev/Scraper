import { describe, expect, it } from "vitest";

import { parseLeadFilters, serializeLeadFilters } from "./lead-filter-params";

describe("lead filter URL parameters", () => {
  it("parses booleans, sort values, and pagination", () => {
    const filters = parseLeadFilters(
      new URLSearchParams({
        page: "2",
        pageSize: "50",
        search: " roofing ",
        hasPhone: "true",
        hasEmail: "false",
        sortBy: "businessName",
        sortOrder: "asc",
      }),
    );

    expect(filters).toMatchObject({
      page: 2,
      pageSize: 50,
      search: "roofing",
      hasPhone: true,
      hasEmail: false,
      sortBy: "businessName",
      sortOrder: "asc",
    });
  });

  it("drops unsupported boolean and sort input", () => {
    const filters = parseLeadFilters(
      new URLSearchParams({
        hasWebsite: "sometimes",
        sortBy: "unsafeColumn",
        sortOrder: "sideways",
      }),
    );

    expect(filters.hasWebsite).toBeUndefined();
    expect(filters.sortBy).toBe("createdAt");
    expect(filters.sortOrder).toBe("desc");
    expect(serializeLeadFilters(filters).toString()).toBe("");
  });

  it("drops invalid ownership, source, and date filter parameters", () => {
    const filters = parseLeadFilters(
      new URLSearchParams({
        jobId: "not-a-uuid",
        source: "https://unapproved.example",
        createdFrom: "2026-07-23",
        createdTo: "2026-07-01",
      }),
    );

    expect(filters.jobId).toBeUndefined();
    expect(filters.source).toBeUndefined();
    expect(filters.createdFrom).toBeUndefined();
    expect(filters.createdTo).toBeUndefined();
  });

  it("retains strict supported ownership and source filters", () => {
    const filters = parseLeadFilters(
      new URLSearchParams({
        jobId: "4b18c844-ef7c-4c99-960d-4dc47dd0dc9a",
        source: "google-places-api",
        createdFrom: "2026-07-01",
        createdTo: "2026-07-23",
      }),
    );

    expect(filters).toMatchObject({
      jobId: "4b18c844-ef7c-4c99-960d-4dc47dd0dc9a",
      source: "google-places-api",
      createdFrom: "2026-07-01",
      createdTo: "2026-07-23",
    });
  });
});
