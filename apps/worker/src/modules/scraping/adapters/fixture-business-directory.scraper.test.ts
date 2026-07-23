import { describe, expect, it } from "vitest";

import { FixtureBusinessDirectoryScraper } from "./fixture-business-directory.scraper.js";

const input = {
  scrapingJobId: "00000000-0000-4000-8000-000000000001",
  sourceKey: "fixture-directory" as const,
  country: "United States",
  searchQuery: "fictional businesses",
  requestedLimit: 100,
};

describe("FixtureBusinessDirectoryScraper", () => {
  it("extracts fictional fixture records without network access", async () => {
    const result = await new FixtureBusinessDirectoryScraper().scrape(input);
    expect(result.records).toHaveLength(20);
    expect(result.pagesProcessed).toBe(1);
    expect(result.records[0]).toMatchObject({
      businessName: "Bluebonnet Roofing Lab",
      sourceType: "BUSINESS_DIRECTORY",
    });
  });

  it("enforces requestedLimit", async () => {
    const result = await new FixtureBusinessDirectoryScraper().scrape({ ...input, requestedLimit: 3 });
    expect(result.records).toHaveLength(3);
  });

  it("matches a full state name to fixture state codes", async () => {
    const result = await new FixtureBusinessDirectoryScraper().scrape({
      ...input,
      state: "Texas",
      city: "Houston",
      category: "Roofing",
      requestedLimit: 20,
    });
    expect(result.records.length).toBeGreaterThan(0);
  });
});
