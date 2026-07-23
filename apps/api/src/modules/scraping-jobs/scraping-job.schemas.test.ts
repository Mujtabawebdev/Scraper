import { describe, expect, it } from "vitest";
import { createTestScrapingJobSchema } from "./scraping-job.schemas.js";

const validInput = {
  sourceKey: "fixture-directory",
  country: "United States",
  searchQuery: "fictional roofers",
  requestedLimit: 20,
};

describe("createTestScrapingJobSchema", () => {
  it("accepts the fixture source", () => {
    expect(createTestScrapingJobSchema.safeParse(validInput).success).toBe(true);
  });

  it("rejects unknown sources and limits over 100", () => {
    expect(createTestScrapingJobSchema.safeParse({ ...validInput, sourceKey: "arbitrary" }).success).toBe(false);
    expect(createTestScrapingJobSchema.safeParse({ ...validInput, requestedLimit: 101 }).success).toBe(false);
  });
});
