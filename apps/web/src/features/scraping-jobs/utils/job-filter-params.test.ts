import { describe, expect, it } from "vitest";

import { parseJobFilters, serializeJobFilters } from "./job-filter-params";

describe("job filter URL parameters", () => {
  it("parses supported values and safely falls back for invalid values", () => {
    const parsed = parseJobFilters(
      new URLSearchParams({
        page: "-1",
        pageSize: "500",
        status: "RUNNING",
        source: "https://unapproved.example",
        search: " plumbers ",
        sortBy: "progressPercentage",
        sortOrder: "asc",
        createdFrom: "not-a-date",
        createdTo: "2026-99-99",
      }),
    );

    expect(parsed).toEqual({
      page: 1,
      pageSize: 20,
      status: "RUNNING",
      search: "plumbers",
      sortBy: "progressPercentage",
      sortOrder: "asc",
    });
  });

  it("drops a reversed date range instead of sending an invalid API query", () => {
    const parsed = parseJobFilters(
      new URLSearchParams({
        createdFrom: "2026-07-23",
        createdTo: "2026-07-01",
      }),
    );

    expect(parsed.createdFrom).toBeUndefined();
    expect(parsed.createdTo).toBeUndefined();
  });

  it("round-trips non-default server filters", () => {
    const filters = parseJobFilters(
      new URLSearchParams({
        page: "3",
        pageSize: "50",
        source: "fixture-business-directory",
        createdFrom: "2026-07-01",
        createdTo: "2026-07-23",
      }),
    );

    expect(parseJobFilters(serializeJobFilters(filters))).toEqual(filters);
  });
});
