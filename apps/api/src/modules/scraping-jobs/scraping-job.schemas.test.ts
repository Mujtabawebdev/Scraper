import { describe, expect, it } from "vitest";

import {
  createScrapingJobSchema,
  createTestScrapingJobSchema,
  listScrapingJobsQuerySchema,
} from "./scraping-job.schemas.js";

const validInput = {
  source: "fixture-business-directory",
  searchQuery: "plumbers",
  location: "Austin, TX",
  requestedLimit: 20,
} as const;

describe("createScrapingJobSchema", () => {
  it("accepts the approved fixture source and safe limit", () => {
    expect(createScrapingJobSchema.parse(validInput)).toEqual(validInput);
  });

  it("rejects arbitrary URLs, unknown fields, and unsafe limits", () => {
    expect(
      createScrapingJobSchema.safeParse({
        ...validInput,
        source: "https://unapproved.example",
      }).success,
    ).toBe(false);
    expect(
      createScrapingJobSchema.safeParse({ ...validInput, arbitraryUrl: "https://example.test" })
        .success,
    ).toBe(false);
    expect(
      createScrapingJobSchema.safeParse({ ...validInput, requestedLimit: 101 }).success,
    ).toBe(false);
  });

  it("enforces trimmed search and location lengths", () => {
    expect(
      createScrapingJobSchema.safeParse({ ...validInput, searchQuery: "x" }).success,
    ).toBe(false);
    expect(
      createScrapingJobSchema.safeParse({ ...validInput, location: " " }).success,
    ).toBe(false);
  });
});

describe("listScrapingJobsQuerySchema", () => {
  it("applies safe pagination and sort defaults", () => {
    expect(listScrapingJobsQuerySchema.parse({})).toMatchObject({
      page: 1,
      pageSize: 20,
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  });

  it("coerces pagination and rejects unsupported filters or reversed dates", () => {
    expect(
      listScrapingJobsQuerySchema.parse({ page: "2", pageSize: "50" }),
    ).toMatchObject({ page: 2, pageSize: 50 });
    expect(
      listScrapingJobsQuerySchema.safeParse({ pageSize: "101" }).success,
    ).toBe(false);
    expect(
      listScrapingJobsQuerySchema.safeParse({ status: "PAUSED" }).success,
    ).toBe(false);
    expect(
      listScrapingJobsQuerySchema.safeParse({
        createdFrom: "2026-07-24T00:00:00.000Z",
        createdTo: "2026-07-23T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("normalizes date-only boundaries to the full UTC day", () => {
    const result = listScrapingJobsQuerySchema.parse({
      createdFrom: "2026-07-01",
      createdTo: "2026-07-23",
    });
    expect(result.createdFrom?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    expect(result.createdTo?.toISOString()).toBe("2026-07-23T23:59:59.999Z");
  });
});

describe("createTestScrapingJobSchema", () => {
  const legacyInput = {
    sourceKey: "fixture-directory",
    country: "United States",
    searchQuery: "fictional roofers",
    requestedLimit: 20,
  };

  it("preserves the authenticated Phase 4 fixture contract", () => {
    expect(createTestScrapingJobSchema.safeParse(legacyInput).success).toBe(true);
  });

  it("preserves the environment-gated Phase 4 development adapter", () => {
    expect(
      createTestScrapingJobSchema.safeParse({
        ...legacyInput,
        sourceKey: "permitted-http-directory",
      }).success,
    ).toBe(true);
  });

  it("does not turn the compatibility route into an arbitrary source selector", () => {
    expect(
      createTestScrapingJobSchema.safeParse({
        ...legacyInput,
        sourceKey: "https://unapproved.example",
      }).success,
    ).toBe(false);
  });
});
