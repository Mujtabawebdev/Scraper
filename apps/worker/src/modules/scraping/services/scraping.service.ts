import type { ScrapeInput } from "../contracts/scrape-input.types.js";
import type { AcquisitionStage } from "@lead-saas/shared-types";
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
  onStage?: (
    stage: AcquisitionStage,
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

const publishStage = async (
  control: ScrapingRunControl,
  stage: AcquisitionStage,
  progress: number,
  counts: ProgressCounts,
): Promise<boolean> => {
  if (control.onStage) {
    return (await control.onStage(stage, progress, counts)) !== false;
  }
  return publishProgress(control, progress, counts);
};

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
  if (
    !(await publishStage(
      control,
      "DISCOVER_BUSINESSES",
      5,
      emptyCounts,
    ))
  ) {
    return cancelledResult(emptyCounts, 0);
  }
  if (
    !(await publishStage(
      control,
      "FETCH_SOURCE_DETAILS",
      12,
      emptyCounts,
    ))
  ) {
    return cancelledResult(emptyCounts, 0);
  }
  if (
    !(await publishStage(
      control,
      "DISCOVER_OFFICIAL_WEBSITE",
      18,
      emptyCounts,
    ))
  ) {
    return cancelledResult(emptyCounts, 0);
  }
  if (
    !(await publishStage(
      control,
      "CRAWL_PUBLIC_CONTACT_PAGES",
      24,
      emptyCounts,
    ))
  ) {
    return cancelledResult(emptyCounts, 0);
  }

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
  if (
    !(await publishStage(
      control,
      "EXTRACT_CONTACT_DATA",
      35,
      scrapedCounts,
    ))
  ) {
    return cancelledResult(scrapedCounts, scrapeResult.pagesProcessed);
  }

  const normalizedRecords = scrapeResult.records.map(normalizeBusiness);
  if (
    !(await publishStage(
      control,
      "NORMALIZE_PHONE",
      48,
      scrapedCounts,
    ))
  ) {
    return cancelledResult(scrapedCounts, scrapeResult.pagesProcessed);
  }
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
  if (
    !(await publishStage(
      control,
      "VALIDATE_PHONE",
      58,
      preparedCounts,
    ))
  ) {
    return cancelledResult(preparedCounts, scrapeResult.pagesProcessed);
  }
  if (
    !(await publishStage(
      control,
      "DEDUPLICATE",
      68,
      preparedCounts,
    ))
  ) {
    return cancelledResult(preparedCounts, scrapeResult.pagesProcessed);
  }
  if (
    !(await publishStage(
      control,
      "SCORE_CONFIDENCE",
      76,
      preparedCounts,
    ))
  ) {
    return cancelledResult(preparedCounts, scrapeResult.pagesProcessed);
  }

  if (
    !(await publishStage(
      control,
      "PERSIST_LEAD",
      82,
      preparedCounts,
    ))
  ) {
    return cancelledResult(preparedCounts, scrapeResult.pagesProcessed);
  }
  const persisted = await persistLeads(batch.unique, {
    scrapingJobId: input.scrapingJobId,
    userId: control.userId,
    sourceKey: input.sourceKey,
    shouldCancel: control.shouldCancel,
    onProgress: async (persistenceProgress) => {
      const progress =
        persistenceProgress.total === 0
          ? 90
          : 82 + Math.round((persistenceProgress.completed / persistenceProgress.total) * 15);
      return publishProgress(control, Math.min(progress, 90), {
        processedCount,
        successCount: persistenceProgress.successCount,
        failureCount: preparedCounts.failureCount,
        duplicateCount: batch.duplicates + persistenceProgress.duplicateCount,
      });
    },
  });

  await publishStage(control, "COMPLETE_JOB", 99, {
    processedCount,
    successCount: persisted.successCount,
    failureCount: preparedCounts.failureCount,
    duplicateCount: batch.duplicates + persisted.duplicateCount,
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
