import type { ScrapingSourceKey, ScrapingJobQueueSource } from "@lead-saas/shared-types";

import { prisma } from "../../../infrastructure/database/prisma.js";
import { scraperRegistry } from "../registry/scraper.registry.js";
import { deduplicateBatch } from "./lead-deduplication.service.js";
import { normalizeBusiness } from "./lead-normalization.service.js";
import { persistLeads } from "./lead-persistence.service.js";
import type { ScrapeInput } from "../contracts/scrape-input.types.js";
import type { ScrapedBusiness, ScraperResult } from "../contracts/scraped-business.types.js";
import type { ScrapingServiceResult, ScrapingRunControl } from "./scraping.service.js";
import { logger } from "../../../common/logger/logger.js";

const publishProgress = async (
  control: ScrapingRunControl,
  progress: number,
  counts: Pick<ScrapingServiceResult, "processedCount" | "successCount" | "failureCount" | "duplicateCount">,
): Promise<void> => {
  await control.onProgress(progress, counts);
};

export type SourceExecutionOutcome = {
  sourceKey: ScrapingSourceKey;
  publicSource: ScrapingJobQueueSource;
  status: "COMPLETED" | "SKIPPED" | "BLOCKED" | "FAILED";
  recordsFetched: number;
  uniqueRecordsAccepted: number;
  duplicateRecordsDiscarded: number;
  failureReason?: string;
};

export type MultiSourceOrchestrationResult = ScrapingServiceResult & {
  outcomes: SourceExecutionOutcome[];
};

const sourceKeyToPublicSource = (sourceKey: ScrapingSourceKey): ScrapingJobQueueSource => {
  switch (sourceKey) {
    case "fixture-directory":
      return "fixture-business-directory";
    case "permitted-http-directory":
      return "permitted-http-directory";
    case "google-places-api":
      return "google-places-api";
    case "government-dataset":
      return "government-dataset";
    case "meta-approved-api":
      return "meta-approved-api";
    case "yelp-approved-api":
      return "yelp-approved-api";
  }
};

const sourceOrder = [
  "google-places-api",
  "government-dataset",
  "meta-approved-api",
  "yelp-approved-api",
  "permitted-http-directory",
  "fixture-directory",
] as const satisfies readonly ScrapingSourceKey[];

const isEligibleSource = async (sourceKey: ScrapingSourceKey): Promise<boolean> => {
  if (sourceKey === "fixture-directory") {
    return true;
  }
  const approvedSource = await prisma.approvedSource.findFirst({
    where: {
      key: sourceKeyToPublicSource(sourceKey),
      status: "APPROVED",
      isEnabled: true,
      allowsAutomatedAccess: true,
    },
    select: { id: true },
  });
  return Boolean(approvedSource);
};

const toScrapeInput = (input: ScrapeInput): ScrapeInput => input;

const runSingleSourceExecution = async (
  input: ScrapeInput,
  control: ScrapingRunControl,
): Promise<Omit<MultiSourceOrchestrationResult, "outcomes">> => {
  const scraper = scraperRegistry.get(input.sourceKey);
  const scrapeResult = await scraper.scrape(toScrapeInput(input));
  const processedCount = scrapeResult.records.length + scrapeResult.skippedRecords;

  const normalizedRecords = scrapeResult.records
    .map(normalizeBusiness)
    .filter((record): record is NonNullable<typeof record> => record !== null);
  const invalidCountAfterNormalization = scrapeResult.records.length - normalizedRecords.length;

  if (await control.shouldCancel()) {
    return {
      processedCount,
      successCount: 0,
      failureCount: invalidCountAfterNormalization + scrapeResult.skippedRecords,
      duplicateCount: 0,
      pagesProcessed: scrapeResult.pagesProcessed,
      cancelled: true,
    };
  }
  const batch = deduplicateBatch(normalizedRecords);
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
        failureCount: invalidCountAfterNormalization + scrapeResult.skippedRecords,
        duplicateCount: batch.duplicates + persistenceProgress.duplicateCount,
      });
    },
  });

  return {
    processedCount,
    successCount: persisted.successCount,
    failureCount: invalidCountAfterNormalization + scrapeResult.skippedRecords,
    duplicateCount: batch.duplicates + persisted.duplicateCount,
    pagesProcessed: scrapeResult.pagesProcessed,
    cancelled: persisted.cancelled,
  };
};

export const runMultiSourceOrchestration = async (
  input: ScrapeInput,
  control: ScrapingRunControl,
): Promise<MultiSourceOrchestrationResult> => {
  if (input.sourceKey === "fixture-directory") {
    const result = await runSingleSourceExecution(input, control);
    return {
      ...result,
      outcomes: [
        {
          sourceKey: input.sourceKey,
          publicSource: "fixture-business-directory",
          status: result.cancelled ? "SKIPPED" : "COMPLETED",
          recordsFetched: result.processedCount,
          uniqueRecordsAccepted: result.successCount,
          duplicateRecordsDiscarded: result.duplicateCount,
        },
      ],
    };
  }

  const eligibleSources = (await Promise.all(
    sourceOrder.map(async (sourceKey) => {
      const eligible = await isEligibleSource(sourceKey);
      return eligible ? sourceKey : null;
    }),
  )).filter((value): value is ScrapingSourceKey => value !== null);

  if (eligibleSources.length === 0) {
    throw new Error("No eligible approved sources are available");
  }

  const outcomes: SourceExecutionOutcome[] = [];
  const seenInitialKeys = new Set<string>();
  let processedCount = 0;
  let successCount = 0;
  let failureCount = 0;
  let duplicateCount = 0;
  const requestedLimit = Math.max(1, input.requestedLimit);

  for (const sourceKey of eligibleSources) {
    if (await control.shouldCancel()) {
      break;
    }

    const publicSource = sourceKeyToPublicSource(sourceKey);
    const outcome = await (async () => {
      try {
        const approvedSource = await prisma.approvedSource.findFirst({
          where: {
            key: publicSource,
            status: "APPROVED",
            isEnabled: true,
            allowsAutomatedAccess: true,
          },
          select: { key: true, requestsPerMinute: true, maxConcurrency: true },
        });
        if (!approvedSource) {
          return {
            sourceKey,
            publicSource,
            status: "SKIPPED",
            recordsFetched: 0,
            uniqueRecordsAccepted: 0,
            duplicateRecordsDiscarded: 0,
            failureReason: "Source is not enabled or approved",
          } satisfies SourceExecutionOutcome;
        }

        const scraper = scraperRegistry.get(sourceKey);
        const scrapeResult = await scraper.scrape(toScrapeInput({
          ...input,
          sourceKey,
          requestPolicy: {
            requestsPerMinute: approvedSource.requestsPerMinute,
            maxConcurrency: approvedSource.maxConcurrency,
          },
        }));

        const normalizedRecords = scrapeResult.records
          .map(normalizeBusiness)
          .filter((record): record is NonNullable<typeof record> => record !== null);
        const batch = deduplicateBatch(normalizedRecords);
        const persisted = await persistLeads(batch.unique, {
          scrapingJobId: input.scrapingJobId,
          userId: control.userId,
          sourceKey,
          shouldCancel: control.shouldCancel,
          onProgress: async () => undefined,
        });

        const uniqueAccepted = persisted.successCount;
        const duplicatesDiscarded = persisted.duplicateCount + batch.duplicates;
        processedCount += scrapeResult.records.length + scrapeResult.skippedRecords;
        successCount += uniqueAccepted;
        failureCount += scrapeResult.skippedRecords;
        duplicateCount += duplicatesDiscarded;

        if (uniqueAccepted > 0) {
          const freshKeys = batch.unique.map((record) => JSON.stringify(record));
          freshKeys.forEach((key) => seenInitialKeys.add(key));
        }

        return {
          sourceKey,
          publicSource,
          status: "COMPLETED",
          recordsFetched: scrapeResult.records.length,
          uniqueRecordsAccepted: uniqueAccepted,
          duplicateRecordsDiscarded: duplicatesDiscarded,
        } satisfies SourceExecutionOutcome;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown source error";
        logger.warn({ sourceKey, error: message }, "Multi-source orchestration source failed");
        return {
          sourceKey,
          publicSource,
          status: "FAILED",
          recordsFetched: 0,
          uniqueRecordsAccepted: 0,
          duplicateRecordsDiscarded: 0,
          failureReason: message,
        } satisfies SourceExecutionOutcome;
      }
    })();

    outcomes.push(outcome);

    if (successCount >= requestedLimit) {
      break;
    }
  }

  return {
    processedCount,
    successCount,
    failureCount,
    duplicateCount,
    pagesProcessed: 0,
    cancelled: false,
    outcomes,
  };
};
