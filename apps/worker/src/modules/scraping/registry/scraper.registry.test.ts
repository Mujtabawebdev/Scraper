import type { ScrapingSourceKey } from "@lead-saas/shared-types";
import { describe, expect, it } from "vitest";

import { SourceNotPermittedError } from "../errors/source-not-permitted.error.js";
import { ScraperRegistry } from "./scraper.registry.js";

describe("ScraperRegistry", () => {
  it("returns the local fixture adapter", () => {
    expect(new ScraperRegistry().get("fixture-directory").sourceKey).toBe("fixture-directory");
  });

  it("rejects unknown sources", () => {
    expect(() => new ScraperRegistry().get("unknown" as ScrapingSourceKey)).toThrow(SourceNotPermittedError);
  });

  it("keeps the external adapter disabled by default", () => {
    expect(() => new ScraperRegistry().get("permitted-http-directory")).toThrow(SourceNotPermittedError);
  });
});
