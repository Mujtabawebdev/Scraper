import type { ScrapeInput } from "../contracts/scrape-input.types.js";
import { scraperRegistry } from "../registry/scraper.registry.js";
import { deduplicateBatch } from "./lead-deduplication.service.js";
import { normalizeBusiness } from "./lead-normalization.service.js";
import { persistLeads } from "./lead-persistence.service.js";

export type ScrapingServiceResult = {
  processedCount: number;
  successCount: number;
  failureCount: number;
  duplicateCount: number;
  pagesProcessed: number;
  cancelled: boolean;
};

type ProgressCounts = Pick<
  ScrapingServiceResult,
  "processedCount" | "successCount" | "failureCount" | "duplicateCount"
>;

export type ScrapingRunControl = {
  userId: string;
  shouldCancel: () => Promise<boolean>;
  onProgress: (
    progress: number,
    counts: ProgressCounts,
  ) => Promise<boolean | void>;
};

const cancelledResult = (
  counts: ProgressCounts,
  pagesProcessed: number,
): ScrapingServiceResult => ({
  ...counts,
  pagesProcessed,
  cancelled: true,
});

const publishProgress = async (
  control: ScrapingRunControl,
  progress: number,
  counts: ProgressCounts,
): Promise<boolean> => (await control.onProgress(progress, counts)) !== false;

export const runScraping = async (
  input: ScrapeInput,
  control: ScrapingRunControl,
): Promise<ScrapingServiceResult> => {
  const emptyCounts: ProgressCounts = {
    processedCount: 0,
    successCount: 0,
    failureCount: 0,
    duplicateCount: 0,
  };
  if (await control.shouldCancel()) return cancelledResult(emptyCounts, 0);

  const scrapeResult = await scraperRegistry.get(input.sourceKey).scrape(input);
  const processedCount = scrapeResult.records.length + scrapeResult.skippedRecords;
  const scrapedCounts: ProgressCounts = {
    processedCount,
    successCount: 0,
    failureCount: scrapeResult.skippedRecords,
    duplicateCount: 0,
  };
  if (await control.shouldCancel()) {
    return cancelledResult(scrapedCounts, scrapeResult.pagesProcessed);
  }
  if (!(await publishProgress(control, 30, scrapedCounts))) {
    return cancelledResult(scrapedCounts, scrapeResult.pagesProcessed);
  }

  const normalizedRecords = scrapeResult.records.map(normalizeBusiness);
  const validRecords = normalizedRecords.filter((record) => record !== null);
  const invalidCount = normalizedRecords.length - validRecords.length;
  const batch = deduplicateBatch(validRecords);
  const preparedCounts: ProgressCounts = {
    processedCount,
    successCount: 0,
    failureCount: invalidCount + scrapeResult.skippedRecords,
    duplicateCount: batch.duplicates,
  };
  if (await control.shouldCancel()) {
    return cancelledResult(preparedCounts, scrapeResult.pagesProcessed);
  }
  if (!(await publishProgress(control, 60, preparedCounts))) {
    return cancelledResult(preparedCounts, scrapeResult.pagesProcessed);
  }

  const persisted = await persistLeads(batch.unique, {
    scrapingJobId: input.scrapingJobId,
    userId: control.userId,
    shouldCancel: control.shouldCancel,
    onProgress: async (persistenceProgress) => {
      const progress =
        persistenceProgress.total === 0
          ? 90
          : 60 + Math.round((persistenceProgress.completed / persistenceProgress.total) * 30);
      return publishProgress(control, Math.min(progress, 90), {
        processedCount,
        successCount: persistenceProgress.successCount,
        failureCount: preparedCounts.failureCount,
        duplicateCount: batch.duplicates + persistenceProgress.duplicateCount,
      });
    },
  });

  return {
    processedCount,
    successCount: persisted.successCount,
    failureCount: preparedCounts.failureCount,
    duplicateCount: batch.duplicates + persisted.duplicateCount,
    pagesProcessed: scrapeResult.pagesProcessed,
    cancelled: persisted.cancelled,
  };
};
