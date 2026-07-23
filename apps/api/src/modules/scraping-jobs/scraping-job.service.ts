import type {
  ScrapingJobQueueData,
  ScrapingJobQueueSource,
  ScrapingSourceKey,
  ScrapingJobSummary,
} from "@lead-saas/shared-types";

import { logger } from "../../common/logger/logger.js";
import { env } from "../../config/env.js";
import {
  enqueueScrapingJob,
  removeScrapingQueueJob,
} from "../../infrastructure/queue/scraping.queue.js";
import {
  queueUnavailableError,
  scrapingJobNotCancellableError,
  scrapingJobNotFoundError,
  scrapingJobNotRetryableError,
  sourceNotPermittedError,
} from "./scraping-job.errors.js";
import { assertAutomatedAccessAllowed } from "../admin/source-policy.service.js";
import {
  createPaginationMetadata,
  mapScrapingJobDetail,
  mapScrapingJobSummary,
} from "./scraping-job.mapper.js";
import {
  cancelOwnedScrapingJob,
  createScrapingJobRecord,
  findOwnedScrapingJobDetail,
  findOwnedScrapingJobForRetry,
  findOwnedScrapingJobSummary,
  listOwnedScrapingJobs,
  markScrapingJobEnqueueFailed,
  markScrapingJobQueued,
} from "./scraping-job.repository.js";
import type {
  CreateScrapingJobInput,
  CreateTestScrapingJobInput,
  ListScrapingJobsQuery,
  NewScrapingJobData,
} from "./scraping-job.types.js";

type QueueLocation = {
  city?: string;
  state?: string;
};

const sourceKeyByPublicSource = {
  "fixture-business-directory": "fixture-directory",
  "permitted-http-directory": "permitted-http-directory",
} as const satisfies Record<ScrapingJobQueueSource, ScrapingSourceKey>;

const isSupportedSource = (source: string): source is ScrapingJobQueueSource =>
  source === "fixture-business-directory" ||
  source === "permitted-http-directory";

const assertSourceIsEnabled = async (
  source: ScrapingJobQueueSource,
): Promise<void> => {
  await assertAutomatedAccessAllowed(source);
  if (
    source === "permitted-http-directory" &&
    (!env.SCRAPING_EXTERNAL_SOURCE_ENABLED || !env.SCRAPING_APPROVED_BASE_URL)
  ) {
    throw sourceNotPermittedError();
  }
};

const parseQueueLocation = (location: string): QueueLocation => {
  const parts = location
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return {};
  const state = parts.at(-1);
  const city = parts.slice(0, -1).join(", ");
  return {
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
  };
};

const enqueueNewScrapingJob = async (
  data: NewScrapingJobData,
): Promise<{ job: ScrapingJobSummary; queueJobId: string }> => {
  await assertSourceIsEnabled(data.source);
  const queueLocation = {
    ...parseQueueLocation(data.location),
    ...(data.city ? { city: data.city } : {}),
    ...(data.state ? { state: data.state } : {}),
  };
  // Persist the same canonical location fields that the worker consumes. The
  // database remains authoritative if a queue payload is delayed or retried.
  const databaseJob = await createScrapingJobRecord({
    ...data,
    ...queueLocation,
  });
  const queueData: ScrapingJobQueueData = {
    scrapingJobId: databaseJob.id,
    sourceKey: sourceKeyByPublicSource[data.source],
    source: data.source,
    country: data.country ?? "United States",
    searchQuery: data.searchQuery,
    requestedLimit: data.requestedLimit,
    requestedById: data.userId,
    ...queueLocation,
    ...(data.category ? { category: data.category } : {}),
  };

  let queueJob: Awaited<ReturnType<typeof enqueueScrapingJob>>;
  try {
    queueJob = await enqueueScrapingJob(queueData);
  } catch (error: unknown) {
    try {
      await markScrapingJobEnqueueFailed(databaseJob.id, data.userId);
    } catch {
      logger.error(
        { scrapingJobId: databaseJob.id },
        "Failed to record scraping queue submission failure",
      );
    }
    logger.error(
      {
        scrapingJobId: databaseJob.id,
        errorType: error instanceof Error ? error.name : "UnknownError",
      },
      "Scraping queue submission failed",
    );
    throw queueUnavailableError();
  }

  const queueJobId = String(queueJob.id ?? databaseJob.id);
  try {
    await markScrapingJobQueued(databaseJob.id, data.userId, queueJobId);
  } catch (error: unknown) {
    try {
      await removeScrapingQueueJob(queueJobId);
    } catch {
      logger.warn(
        { scrapingJobId: databaseJob.id },
        "Queued scraping job could not be removed after database transition failure",
      );
    }
    try {
      await markScrapingJobEnqueueFailed(databaseJob.id, data.userId);
    } catch {
      logger.error(
        { scrapingJobId: databaseJob.id },
        "Failed to record scraping queue transition failure",
      );
    }
    logger.error(
      {
        scrapingJobId: databaseJob.id,
        errorType: error instanceof Error ? error.name : "UnknownError",
      },
      "Scraping queue database transition failed",
    );
    throw queueUnavailableError();
  }

  let currentJob;
  try {
    currentJob = await findOwnedScrapingJobSummary(databaseJob.id, data.userId);
  } catch {
    logger.warn(
      { scrapingJobId: databaseJob.id },
      "Queued scraping job could not be refreshed for the immediate response",
    );
  }

  return {
    job: mapScrapingJobSummary(
      currentJob ?? { ...databaseJob, status: "QUEUED" },
    ),
    queueJobId,
  };
};

export const createScrapingJob = async (
  userId: string,
  input: CreateScrapingJobInput,
) => enqueueNewScrapingJob({ ...input, userId });

export const createAndEnqueueTestJob = async (
  userId: string,
  input: CreateTestScrapingJobInput,
) => {
  const location = [input.city, input.state, input.country].filter(Boolean).join(", ");
  const source: ScrapingJobQueueSource =
    input.sourceKey === "fixture-directory"
      ? "fixture-business-directory"
      : "permitted-http-directory";
  return enqueueNewScrapingJob({
    userId,
    source,
    searchQuery: input.searchQuery,
    location,
    requestedLimit: input.requestedLimit,
    country: input.country,
    ...(input.state ? { state: input.state } : {}),
    ...(input.city ? { city: input.city } : {}),
    ...(input.category ? { category: input.category } : {}),
  });
};

export const listScrapingJobs = async (
  userId: string,
  query: ListScrapingJobsQuery,
) => {
  const result = await listOwnedScrapingJobs(userId, query);
  return {
    jobs: result.jobs.map(mapScrapingJobSummary),
    pagination: createPaginationMetadata(
      query.page,
      query.pageSize,
      result.totalItems,
    ),
  };
};

export const getScrapingJob = async (userId: string, jobId: string) => {
  const job = await findOwnedScrapingJobDetail(jobId, userId);
  if (!job) throw scrapingJobNotFoundError();
  return mapScrapingJobDetail(job);
};

export const cancelScrapingJob = async (userId: string, jobId: string) => {
  const existing = await findOwnedScrapingJobDetail(jobId, userId);
  if (!existing) throw scrapingJobNotFoundError();
  if (
    existing.status !== "PENDING" &&
    existing.status !== "QUEUED" &&
    existing.status !== "RUNNING"
  ) {
    throw scrapingJobNotCancellableError();
  }

  const cancelled = await cancelOwnedScrapingJob(jobId, userId);
  if (!cancelled) throw scrapingJobNotCancellableError();

  if (existing.queueJobId) {
    try {
      await removeScrapingQueueJob(existing.queueJobId);
    } catch (error: unknown) {
      // The database cancellation marker is authoritative. An active worker
      // will observe it cooperatively even when BullMQ cannot remove the job.
      logger.warn(
        {
          scrapingJobId: jobId,
          errorType: error instanceof Error ? error.name : "UnknownError",
        },
        "Scraping queue job could not be removed after cancellation",
      );
    }
  }

  return getScrapingJob(userId, jobId);
};

export const retryScrapingJob = async (userId: string, jobId: string) => {
  const original = await findOwnedScrapingJobForRetry(jobId, userId);
  if (!original) throw scrapingJobNotFoundError();
  if (original.status !== "FAILED" || !isSupportedSource(original.source)) {
    throw scrapingJobNotRetryableError();
  }

  return enqueueNewScrapingJob({
    userId,
    source: original.source,
    searchQuery: original.searchQuery ?? "Retried scraping job",
    location: original.location,
    requestedLimit: original.requestedLimit,
    country: original.country,
    retryOfJobId: original.id,
    ...(original.state ? { state: original.state } : {}),
    ...(original.city ? { city: original.city } : {}),
    ...(original.category ? { category: original.category } : {}),
  });
};
