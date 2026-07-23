import { describe, expect, it } from "vitest";

import { createScrapingJobSchema } from "./scraping-job.schemas";

const validJob = {
  source: "google-places-api",
  searchQuery: "plumbers",
  location: "Austin, TX",
  requestedLimit: 25,
};

describe("createScrapingJobSchema", () => {
  it("normalizes valid job criteria", () => {
    const result = createScrapingJobSchema.parse({
      ...validJob,
      searchQuery: "  commercial   plumbers ",
      location: "  Austin,   TX ",
    });

    expect(result).toEqual({
      ...validJob,
      searchQuery: "commercial plumbers",
      location: "Austin, TX",
    });
  });

  it.each([
    ["an arbitrary source", { ...validJob, source: "https://example.com" }],
    ["an arbitrary URL field", { ...validJob, url: "https://example.com" }],
    ["an empty query", { ...validJob, searchQuery: " " }],
    ["a zero limit", { ...validJob, requestedLimit: 0 }],
    ["an excessive limit", { ...validJob, requestedLimit: 101 }],
    ["a fractional limit", { ...validJob, requestedLimit: 2.5 }],
  ])("rejects %s", (_caseName, input) => {
    expect(createScrapingJobSchema.safeParse(input).success).toBe(false);
  });
});
