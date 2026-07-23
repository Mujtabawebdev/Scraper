import { describe, expect, it } from "vitest";

import {
  exportLeadsQuerySchema,
  listLeadsQuerySchema,
} from "./lead.schemas.js";

describe("listLeadsQuerySchema", () => {
  it("applies Phase 7 pagination and sort defaults", () => {
    expect(listLeadsQuerySchema.parse({})).toMatchObject({
      page: 1,
      pageSize: 25,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  });

  it("coerces supported boolean filters", () => {
    expect(
      listLeadsQuerySchema.parse({
        hasPhone: "true",
        hasEmail: "false",
        hasWebsite: "true",
      }),
    ).toMatchObject({
      hasPhone: true,
      hasEmail: false,
      hasWebsite: true,
    });
  });

  it("rejects unsafe pagination, unknown filters, and unsupported sort fields", () => {
    expect(listLeadsQuerySchema.safeParse({ pageSize: "101" }).success).toBe(false);
    expect(listLeadsQuerySchema.safeParse({ arbitrary: "value" }).success).toBe(false);
    expect(listLeadsQuerySchema.safeParse({ sortBy: "email" }).success).toBe(false);
    expect(
      listLeadsQuerySchema.safeParse({ source: "https://unapproved.example" }).success,
    ).toBe(false);
  });

  it("rejects a reversed created date range", () => {
    expect(
      listLeadsQuerySchema.safeParse({
        createdFrom: "2026-07-24T00:00:00.000Z",
        createdTo: "2026-07-23T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("normalizes date-only boundaries to the full UTC day", () => {
    const result = listLeadsQuerySchema.parse({
      createdFrom: "2026-07-01",
      createdTo: "2026-07-23",
    });
    expect(result.createdFrom?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(result.createdTo?.toISOString()).toBe("2026-07-23T23:59:59.999Z");
  });
});

describe("exportLeadsQuerySchema", () => {
  it("supports list filters without accepting pagination controls", () => {
    expect(
      exportLeadsQuerySchema.safeParse({
        search: "plumber",
        city: "Austin",
        hasPhone: "true",
      }).success,
    ).toBe(true);
    expect(exportLeadsQuerySchema.safeParse({ page: "1" }).success).toBe(false);
  });
});
