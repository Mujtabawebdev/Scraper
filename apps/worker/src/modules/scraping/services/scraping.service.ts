import type { ScrapeInput } from "../contracts/scrape-input.types.js";
import { scraperRegistry } from "../registry/scraper.registry.js";
import { deduplicateBatch } from "./lead-deduplication.service.js";
import { normalizeBusiness } from "./lead-normalization.service.js";
import { persistLeads } from "./lead-persistence.service.js";

export type ScrapingServiceResult = {
  processedCount: number;
  collectedCount: number;
  failedCount: number;
  skippedCount: number;
  pagesProcessed: number;
};

type ProgressCallback = (
  progress: number,
  counts: Pick<ScrapingServiceResult, "processedCount" | "collectedCount" | "failedCount">,
) => Promise<void>;

export const runScraping = async (
  input: ScrapeInput,
  onProgress: ProgressCallback,
): Promise<ScrapingServiceResult> => {
  const scrapeResult = await scraperRegistry.get(input.sourceKey).scrape(input);
  await onProgress(30, { processedCount: scrapeResult.records.length, collectedCount: 0, failedCount: 0 });

  const normalizedRecords = scrapeResult.records.map(normalizeBusiness);
  const validRecords = normalizedRecords.filter((record) => record !== null);
  const invalidCount = normalizedRecords.length - validRecords.length;
  const batch = deduplicateBatch(validRecords);
  await onProgress(60, {
    processedCount: scrapeResult.records.length,
    collectedCount: 0,
    failedCount: invalidCount + batch.duplicates + scrapeResult.skippedRecords,
  });

  const persisted = await persistLeads(batch.unique, input.scrapingJobId, async (completed, total) => {
    const progress = total === 0 ? 90 : 60 + Math.round((completed / total) * 30);
    await onProgress(progress, {
      processedCount: scrapeResult.records.length,
      collectedCount: 0,
      failedCount: invalidCount + batch.duplicates + scrapeResult.skippedRecords,
    });
  });
  const skippedCount = invalidCount + batch.duplicates + persisted.duplicateCount + scrapeResult.skippedRecords;
  return {
    processedCount: scrapeResult.records.length,
    collectedCount: persisted.collectedCount,
    failedCount: skippedCount,
    skippedCount,
    pagesProcessed: scrapeResult.pagesProcessed,
  };
};
