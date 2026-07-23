import { beforeEach, describe, expect, it, vi } from "vitest";

const serviceMocks = vi.hoisted(() => ({
  getScraper: vi.fn(),
  scrape: vi.fn(),
  persistLeads: vi.fn(),
}));

vi.mock("../registry/scraper.registry.js", () => ({
  scraperRegistry: {
    get: serviceMocks.getScraper,
  },
}));

vi.mock("./lead-persistence.service.js", () => ({
  persistLeads: serviceMocks.persistLeads,
}));

import type { ScrapeInput } from "../contracts/scrape-input.types.js";
import type { ScrapedBusiness } from "../contracts/scraped-business.types.js";
import type {
  LeadPersistenceOptions,
  LeadPersistenceProgress,
} from "./lead-persistence.service.js";
import type { NormalizedBusiness } from "./lead-normalization.service.js";
import { runScraping } from "./scraping.service.js";

const input: ScrapeInput = {
  scrapingJobId: "00000000-0000-4000-8000-000000000002",
  sourceKey: "fixture-directory",
  country: "United States",
  searchQuery: "roofing",
  requestedLimit: 20,
};

const business: ScrapedBusiness = {
  businessName: "Example Roofing",
  phoneRaw: "(202) 555-0101",
  country: "United States",
  sourceType: "BUSINESS_DIRECTORY",
  sourceName: "Fixture",
  sourceUrl: "fixture://directory/one",
  sourceExternalId: "one",
};

describe("runScraping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.getScraper.mockReturnValue({ scrape: serviceMocks.scrape });
  });

  it("keeps failures and duplicates separate and publishes actual persisted counts", async () => {
    serviceMocks.scrape.mockResolvedValue({
      records: [business, { ...business }, { ...business, businessName: " " }],
      pagesProcessed: 1,
      skippedRecords: 2,
      sourceKey: "fixture-directory",
    });
    serviceMocks.persistLeads.mockImplementation(
      async (_records: NormalizedBusiness[], options: LeadPersistenceOptions) => {
        const progress: LeadPersistenceProgress = {
          completed: 1,
          total: 1,
          successCount: 1,
          duplicateCount: 2,
        };
        await options.onProgress?.(progress);
        return { successCount: 1, duplicateCount: 2, cancelled: false };
      },
    );
    const onProgress = vi.fn().mockResolvedValue(true);

    const result = await runScraping(input, {
      userId: "00000000-0000-4000-8000-000000000001",
      shouldCancel: vi.fn().mockResolvedValue(false),
      onProgress,
    });

    expect(serviceMocks.persistLeads).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        scrapingJobId: input.scrapingJobId,
        userId: "00000000-0000-4000-8000-000000000001",
      }),
    );
    expect(onProgress).toHaveBeenNthCalledWith(1, 30, {
      processedCount: 5,
      successCount: 0,
      failureCount: 2,
      duplicateCount: 0,
    });
    expect(onProgress).toHaveBeenNthCalledWith(2, 60, {
      processedCount: 5,
      successCount: 0,
      failureCount: 3,
      duplicateCount: 1,
    });
    expect(onProgress).toHaveBeenNthCalledWith(3, 90, {
      processedCount: 5,
      successCount: 1,
      failureCount: 3,
      duplicateCount: 3,
    });
    expect(result).toEqual({
      processedCount: 5,
      successCount: 1,
      failureCount: 3,
      duplicateCount: 3,
      pagesProcessed: 1,
      cancelled: false,
    });
  });

  it("honors cancellation before invoking an approved adapter", async () => {
    const result = await runScraping(input, {
      userId: "00000000-0000-4000-8000-000000000001",
      shouldCancel: vi.fn().mockResolvedValue(true),
      onProgress: vi.fn(),
    });

    expect(serviceMocks.getScraper).not.toHaveBeenCalled();
    expect(serviceMocks.persistLeads).not.toHaveBeenCalled();
    expect(result).toEqual({
      processedCount: 0,
      successCount: 0,
      failureCount: 0,
      duplicateCount: 0,
      pagesProcessed: 0,
      cancelled: true,
    });
  });

  it("stops after scraping if cancellation arrives before persistence", async () => {
    serviceMocks.scrape.mockResolvedValue({
      records: [business],
      pagesProcessed: 1,
      skippedRecords: 0,
      sourceKey: "fixture-directory",
    });
    const shouldCancel = vi
      .fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    const result = await runScraping(input, {
      userId: "00000000-0000-4000-8000-000000000001",
      shouldCancel,
      onProgress: vi.fn(),
    });

    expect(serviceMocks.scrape).toHaveBeenCalledOnce();
    expect(serviceMocks.persistLeads).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      processedCount: 1,
      successCount: 0,
      failureCount: 0,
      duplicateCount: 0,
      pagesProcessed: 1,
      cancelled: true,
    });
  });
});
