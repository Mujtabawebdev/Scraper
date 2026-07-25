import type { ScrapeInput } from "../contracts/scrape-input.types.js";
import type { AcquisitionStage } from "@lead-saas/shared-types";
import { runMultiSourceOrchestration } from "./multi-source-orchestrator.js";

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

  const result = await runMultiSourceOrchestration(input, control);
  if (await control.shouldCancel()) {
    return cancelledResult(
      {
        processedCount: result.processedCount,
        successCount: result.successCount,
        failureCount: result.failureCount,
        duplicateCount: result.duplicateCount,
      },
      result.pagesProcessed,
    );
  }
  if (
    !(await publishStage(
      control,
      "EXTRACT_CONTACT_DATA",
      35,
      {
        processedCount: result.processedCount,
        successCount: result.successCount,
        failureCount: result.failureCount,
        duplicateCount: result.duplicateCount,
      },
    ))
  ) {
    return cancelledResult(
      {
        processedCount: result.processedCount,
        successCount: result.successCount,
        failureCount: result.failureCount,
        duplicateCount: result.duplicateCount,
      },
      result.pagesProcessed,
    );
  }

  if (
    !(await publishStage(
      control,
      "NORMALIZE_PHONE",
      48,
      {
        processedCount: result.processedCount,
        successCount: result.successCount,
        failureCount: result.failureCount,
        duplicateCount: result.duplicateCount,
      },
    ))
  ) {
    return cancelledResult(
      {
        processedCount: result.processedCount,
        successCount: result.successCount,
        failureCount: result.failureCount,
        duplicateCount: result.duplicateCount,
      },
      result.pagesProcessed,
    );
  }
  if (
    !(await publishStage(
      control,
      "VALIDATE_PHONE",
      58,
      {
        processedCount: result.processedCount,
        successCount: result.successCount,
        failureCount: result.failureCount,
        duplicateCount: result.duplicateCount,
      },
    ))
  ) {
    return cancelledResult(
      {
        processedCount: result.processedCount,
        successCount: result.successCount,
        failureCount: result.failureCount,
        duplicateCount: result.duplicateCount,
      },
      result.pagesProcessed,
    );
  }
  if (
    !(await publishStage(
      control,
      "DEDUPLICATE",
      68,
      {
        processedCount: result.processedCount,
        successCount: result.successCount,
        failureCount: result.failureCount,
        duplicateCount: result.duplicateCount,
      },
    ))
  ) {
    return cancelledResult(
      {
        processedCount: result.processedCount,
        successCount: result.successCount,
        failureCount: result.failureCount,
        duplicateCount: result.duplicateCount,
      },
      result.pagesProcessed,
    );
  }
  if (
    !(await publishStage(
      control,
      "SCORE_CONFIDENCE",
      76,
      {
        processedCount: result.processedCount,
        successCount: result.successCount,
        failureCount: result.failureCount,
        duplicateCount: result.duplicateCount,
      },
    ))
  ) {
    return cancelledResult(
      {
        processedCount: result.processedCount,
        successCount: result.successCount,
        failureCount: result.failureCount,
        duplicateCount: result.duplicateCount,
      },
      result.pagesProcessed,
    );
  }

  if (
    !(await publishStage(
      control,
      "PERSIST_LEAD",
      82,
      {
        processedCount: result.processedCount,
        successCount: result.successCount,
        failureCount: result.failureCount,
        duplicateCount: result.duplicateCount,
      },
    ))
  ) {
    return cancelledResult(
      {
        processedCount: result.processedCount,
        successCount: result.successCount,
        failureCount: result.failureCount,
        duplicateCount: result.duplicateCount,
      },
      result.pagesProcessed,
    );
  }

  await publishStage(control, "COMPLETE_JOB", 99, {
    processedCount: result.processedCount,
    successCount: result.successCount,
    failureCount: result.failureCount,
    duplicateCount: result.duplicateCount,
  });

  return {
    processedCount: result.processedCount,
    successCount: result.successCount,
    failureCount: result.failureCount,
    duplicateCount: result.duplicateCount,
    pagesProcessed: result.pagesProcessed,
    cancelled: result.cancelled,
  };
};
