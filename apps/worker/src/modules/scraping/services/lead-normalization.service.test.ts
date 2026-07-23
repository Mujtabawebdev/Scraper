import { describe, expect, it } from "vitest";

import type { ScrapedBusiness } from "../contracts/scraped-business.types.js";
import { normalizeBusiness } from "./lead-normalization.service.js";

const base: ScrapedBusiness = {
  businessName: "  Example   Roofing  ",
  country: "United States",
  sourceType: "BUSINESS_DIRECTORY",
  sourceName: "Fixture",
  sourceUrl: "fixture://example/1",
};

describe("normalizeBusiness", () => {
  it("rejects an empty business name", () => {
    expect(normalizeBusiness({ ...base, businessName: "   " })).toBeNull();
  });

  it("normalizes valid US phones and keeps invalid phones unnormalized", () => {
    expect(normalizeBusiness({ ...base, phoneRaw: "(202) 555-4321" })?.phoneNormalized).toBe("+12025554321");
    expect(normalizeBusiness({ ...base, phoneRaw: "invalid" })?.phoneNormalized).toBeNull();
  });

  it("normalizes email and safe website/domain values", () => {
    const result = normalizeBusiness({
      ...base,
      email: " INFO@EXAMPLE.TEST ",
      website: "https://www.Example.test/path#section",
    });
    expect(result).toMatchObject({
      businessName: "Example Roofing",
      email: "info@example.test",
      website: "https://www.example.test/path",
      domain: "example.test",
    });
  });

  it("rejects unsafe website protocols", () => {
    expect(normalizeBusiness({ ...base, website: "javascript:alert(1)" })?.website).toBeNull();
  });
});
