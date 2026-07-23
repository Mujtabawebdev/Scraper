import type {
  ApprovedScrapingSource,
  PaginationMetadata,
  ScrapingJobDetail,
  ScrapingJobStatus,
  ScrapingJobSummary,
} from "@lead-saas/shared-types";

import type {
  ScrapingJobDetailRecord,
  ScrapingJobSummaryRecord,
} from "./scraping-job.repository.js";
import { env } from "../../config/env.js";

const toIsoString = (value: Date | null): string | null => value?.toISOString() ?? null;

const toPublicStatus = (status: ScrapingJobSummaryRecord["status"]): ScrapingJobStatus => {
  // PAUSED is a Phase 2 legacy database value and is not part of the public lifecycle.
  if (status === "PAUSED") return "CANCELLED";
  return status;
};

const toPublicSource = (source: string): ApprovedScrapingSource => {
  if (
    source === "fixture-business-directory" ||
    source === "permitted-http-directory"
  ) {
    return source;
  }
  throw new Error("Persisted scraping job has an unsupported source");
};

export const mapScrapingJobSummary = (
  job: ScrapingJobSummaryRecord,
): ScrapingJobSummary => ({
  id: job.id,
  source: toPublicSource(job.source),
  status: toPublicStatus(job.status),
  searchQuery: job.searchQuery ?? job.name,
  location: job.location,
  requestedLimit: job.requestedLimit,
  processedCount: job.processedCount,
  successCount: job.successCount,
  failureCount: job.failureCount,
  duplicateCount: job.duplicateCount,
  progressPercentage: Math.min(100, Math.max(0, job.progressPercentage)),
  createdAt: job.createdAt.toISOString(),
  startedAt: toIsoString(job.startedAt),
  completedAt: toIsoString(job.completedAt),
  failedAt: toIsoString(job.failedAt),
  cancelledAt: toIsoString(job.cancelledAt),
});

export const mapScrapingJobDetail = (
  job: ScrapingJobDetailRecord,
): ScrapingJobDetail => {
  const summary = mapScrapingJobSummary(job);
  const isLegacyPaused = job.status === "PAUSED";

  return {
    ...summary,
    updatedAt: job.updatedAt.toISOString(),
    errorMessage: job.errorMessage,
    leadCount: job._count.leads,
    canCancel:
      !isLegacyPaused &&
      (job.status === "PENDING" || job.status === "QUEUED" || job.status === "RUNNING"),
    canRetry:
      !isLegacyPaused &&
      job.status === "FAILED" &&
      (job.source === "fixture-business-directory" ||
        (job.source === "permitted-http-directory" &&
          env.SCRAPING_EXTERNAL_SOURCE_ENABLED &&
          Boolean(env.SCRAPING_APPROVED_BASE_URL))),
    retryOfJobId: job.retryOfJobId,
  };
};

export const createPaginationMetadata = (
  page: number,
  pageSize: number,
  totalItems: number,
): PaginationMetadata => {
  const totalPages = Math.ceil(totalItems / pageSize);
  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && totalPages > 0,
  };
};
