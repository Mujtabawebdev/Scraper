import { describe, expect, it } from "vitest";

import type { NormalizedBusiness } from "./lead-normalization.service.js";
import { deduplicateBatch } from "./lead-deduplication.service.js";

const record: NormalizedBusiness = {
  businessName: "Example Roofing",
  phoneRaw: "2025550101",
  phoneNormalized: "+12025550101",
  phoneType: "UNKNOWN",
  email: null,
  website: "https://example.test/",
  domain: "example.test",
  addressLine1: "1 Test Road",
  addressLine2: null,
  city: "Houston",
  state: "TX",
  postalCode: "77001",
  country: "United States",
  category: "Roofing",
  sourceType: "BUSINESS_DIRECTORY",
  sourceName: "Fixture",
  sourceUrl: "fixture://directory/1",
  sourceExternalId: "one",
};

describe("deduplicateBatch", () => {
  it("drops deterministic in-batch duplicates", () => {
    const result = deduplicateBatch([record, { ...record, businessName: " example roofing " }]);
    expect(result.unique).toHaveLength(1);
    expect(result.duplicates).toBe(1);
  });

  it("does not reject a different business only for sharing a phone", () => {
    const result = deduplicateBatch([record, { ...record, businessName: "Another Roofing", sourceExternalId: "two" }]);
    expect(result.unique).toHaveLength(2);
  });
});
