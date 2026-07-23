import type {
  ScrapingJobName,
  ScrapingJobQueueData,
  ScrapingJobQueueResult,
  ScrapingSourceKey,
} from "@lead-saas/shared-types";
import { type Job, UnrecoverableError } from "bullmq";

import { prisma } from "../../infrastructure/database/prisma.js";
import { ScraperError } from "../../modules/scraping/errors/scraper.error.js";
import { runScraping } from "../../modules/scraping/services/scraping.service.js";
import {
  assertAutomatedAccessAllowed,
  markSourceBlocked,
  markSourceReviewRequired,
} from "../../modules/scraping/services/source-policy.service.js";

type JobCounts = Pick<
  ScrapingJobQueueResult,
  "processedCount" | "successCount" | "failureCount" | "duplicateCount"
>;

const ACTIVE_JOB_STATUSES = ["PENDING", "QUEUED", "RUNNING"] as const;
const SOURCE_KEY_BY_PUBLIC_SOURCE: Record<
  ScrapingJobQueueData["source"],
  ScrapingSourceKey
> = {
  "fixture-business-directory": "fixture-directory",
  "permitted-http-directory": "permitted-http-directory",
};
const PUBLIC_SOURCE_BY_SOURCE_KEY: Record<
  ScrapingSourceKey,
  ScrapingJobQueueData["source"]
> = {
  "fixture-directory": "fixture-business-directory",
  "permitted-http-directory": "permitted-http-directory",
};

const isScrapingSourceKey = (value: unknown): value is ScrapingSourceKey =>
  value === "fixture-directory" || value === "permitted-http-directory";

const isPublicSource = (
  value: unknown,
): value is ScrapingJobQueueData["source"] =>
  value === "fixture-business-directory" || value === "permitted-http-directory";

const toQueueResult = (
  scrapingJobId: string,
  counts: JobCounts,
  completedAt: Date,
): ScrapingJobQueueResult => ({
  scrapingJobId,
  ...counts,
  completedAt: completedAt.toISOString(),
});

const isUnrecoverable = (error: unknown): boolean =>
  error instanceof UnrecoverableError ||
  (error instanceof Error && error.name === "UnrecoverableError");

const isFinalAttempt = (
  job: Job<ScrapingJobQueueData, ScrapingJobQueueResult, ScrapingJobName>,
  error: unknown,
): boolean => {
  if (isUnrecoverable(error)) return true;
  const configuredAttempts = Math.max(job.opts.attempts ?? 1, 1);
  return job.attemptsMade + 1 >= configuredAttempts;
};

export const getSafeScrapingFailureMessage = (error: unknown): string => {
  if (error instanceof ScraperError) {
    const safeMessages: Record<string, string> = {
      SOURCE_NOT_PERMITTED: "The selected scraping source is not currently available",
      ROBOTS_DISALLOWED: "The approved source policy does not permit this request",
      INVALID_REDIRECT: "The approved source returned an invalid redirect",
      SOURCE_REQUEST_FAILED: "The approved source request was not successful",
      INVALID_CONTENT_TYPE: "The approved source returned an unsupported response",
      RESPONSE_TOO_LARGE: "The approved source response exceeded the safe size limit",
      REDIRECT_LIMIT_EXCEEDED: "The approved source exceeded the safe redirect limit",
    };
    return safeMessages[error.code] ?? "The approved source could not be processed";
  }

  if (isUnrecoverable(error)) {
    return "The scraping job configuration could not be verified";
  }

  return "The scraping job could not be completed";
};

const synchronizeCancelledCounts = async (
  jobData: ScrapingJobQueueData,
  counts: JobCounts,
): Promise<ScrapingJobQueueResult> => {
  await prisma.scrapingJob.updateMany({
    where: {
      id: jobData.scrapingJobId,
      userId: jobData.requestedById,
      status: "CANCELLED",
    },
    data: counts,
  });

  const cancelledJob = await prisma.scrapingJob.findUnique({
    where: { id: jobData.scrapingJobId },
    select: { cancelledAt: true },
  });
  return toQueueResult(
    jobData.scrapingJobId,
    counts,
    cancelledJob?.cancelledAt ?? new Date(),
  );
};

export const processScrapingJob = async (
  job: Job<ScrapingJobQueueData, ScrapingJobQueueResult, ScrapingJobName>,
): Promise<ScrapingJobQueueResult> => {
  let ownerVerified = false;
  let activeSourceKey: ScrapingSourceKey | undefined;

  try {
    const databaseJob = await prisma.scrapingJob.findUnique({
      where: { id: job.data.scrapingJobId },
      select: {
        id: true,
        userId: true,
        source: true,
        country: true,
        state: true,
        city: true,
        category: true,
        searchQuery: true,
        requestedLimit: true,
        status: true,
        queueJobId: true,
        processedCount: true,
        successCount: true,
        failureCount: true,
        duplicateCount: true,
        progressPercentage: true,
        startedAt: true,
        completedAt: true,
        failedAt: true,
        cancelledAt: true,
      },
    });
    if (!databaseJob) throw new UnrecoverableError("SCRAPING_JOB_NOT_FOUND");
    if (databaseJob.userId !== job.data.requestedById) {
      throw new UnrecoverableError("SCRAPING_JOB_OWNERSHIP_MISMATCH");
    }
    if (job.id !== databaseJob.id) {
      throw new UnrecoverableError("SCRAPING_QUEUE_JOB_ID_MISMATCH");
    }
    ownerVerified = true;

    const existingCounts: JobCounts = {
      processedCount: databaseJob.processedCount,
      successCount: databaseJob.successCount,
      failureCount: databaseJob.failureCount,
      duplicateCount: databaseJob.duplicateCount,
    };
    if (databaseJob.status === "CANCELLED") {
      return toQueueResult(
        databaseJob.id,
        existingCounts,
        databaseJob.cancelledAt ?? new Date(),
      );
    }
    if (!ACTIVE_JOB_STATUSES.includes(databaseJob.status as (typeof ACTIVE_JOB_STATUSES)[number])) {
      throw new UnrecoverableError("SCRAPING_JOB_NOT_ACTIVE");
    }

    const runtimeSourceKey: unknown = job.data.sourceKey;
    if (!isScrapingSourceKey(runtimeSourceKey)) {
      throw new UnrecoverableError("SCRAPING_JOB_SOURCE_MISMATCH");
    }
    const derivedPublicSource = PUBLIC_SOURCE_BY_SOURCE_KEY[runtimeSourceKey];
    const runtimePublicSource: unknown = (
      job.data as Partial<Pick<ScrapingJobQueueData, "source">>
    ).source;
    const isLegacyPayload = runtimePublicSource === undefined;
    if (
      !isLegacyPayload &&
      (!isPublicSource(runtimePublicSource) ||
        SOURCE_KEY_BY_PUBLIC_SOURCE[runtimePublicSource] !== runtimeSourceKey)
    ) {
      throw new UnrecoverableError("SCRAPING_JOB_SOURCE_MISMATCH");
    }
    const effectivePublicSource = isLegacyPayload
      ? derivedPublicSource
      : runtimePublicSource;
    activeSourceKey = runtimeSourceKey;

    if (!isLegacyPayload && databaseJob.source !== effectivePublicSource) {
      throw new UnrecoverableError("SCRAPING_JOB_SOURCE_MISMATCH");
    }
    if (databaseJob.queueJobId && databaseJob.queueJobId !== databaseJob.id) {
      throw new UnrecoverableError("SCRAPING_QUEUE_JOB_ID_MISMATCH");
    }

    const shouldSynchronizeLegacySource =
      isLegacyPayload && databaseJob.source !== effectivePublicSource;
    const shouldSynchronizeQueueJobId = databaseJob.queueJobId === null;
    if (shouldSynchronizeLegacySource || shouldSynchronizeQueueJobId) {
      const normalized = await prisma.scrapingJob.updateMany({
        where: {
          id: databaseJob.id,
          userId: job.data.requestedById,
          status: { in: [...ACTIVE_JOB_STATUSES] },
        },
        data: {
          ...(shouldSynchronizeLegacySource ? { source: effectivePublicSource } : {}),
          ...(shouldSynchronizeQueueJobId ? { queueJobId: databaseJob.id } : {}),
        },
      });
      if (normalized.count === 0) {
        const current = await prisma.scrapingJob.findUnique({
          where: { id: databaseJob.id },
          select: {
            status: true,
            cancelledAt: true,
            processedCount: true,
            successCount: true,
            failureCount: true,
            duplicateCount: true,
          },
        });
        if (current?.status === "CANCELLED") {
          return toQueueResult(
            databaseJob.id,
            {
              processedCount: current.processedCount,
              successCount: current.successCount,
              failureCount: current.failureCount,
              duplicateCount: current.duplicateCount,
            },
            current.cancelledAt ?? new Date(),
          );
        }
        throw new UnrecoverableError("SCRAPING_JOB_NORMALIZATION_REJECTED");
      }
    }

    const authoritativeSearchQuery = databaseJob.searchQuery?.trim();
    const authoritativeCountry = databaseJob.country.trim();
    if (
      !authoritativeSearchQuery ||
      !authoritativeCountry ||
      !Number.isInteger(databaseJob.requestedLimit) ||
      databaseJob.requestedLimit < 1
    ) {
      throw new UnrecoverableError("SCRAPING_JOB_CONFIGURATION_INVALID");
    }

    let sourcePolicy;
    try {
      sourcePolicy = await assertAutomatedAccessAllowed(runtimeSourceKey);
    } catch (error: unknown) {
      const code = error instanceof ScraperError ? error.code : "SOURCE_POLICY_FAILED";
      throw new UnrecoverableError(code);
    }

    let lastProgress = Math.min(Math.max(databaseJob.progressPercentage, 5), 99);
    const runningTransition = await prisma.scrapingJob.updateMany({
      where: {
        id: databaseJob.id,
        userId: job.data.requestedById,
        status: { in: [...ACTIVE_JOB_STATUSES] },
      },
      data: {
        status: "RUNNING",
        startedAt: databaseJob.startedAt ?? new Date(),
        errorMessage: null,
        failedAt: null,
        progressPercentage: lastProgress,
      },
    });

    if (runningTransition.count === 0) {
      const current = await prisma.scrapingJob.findUnique({
        where: { id: databaseJob.id },
        select: {
          status: true,
          cancelledAt: true,
          processedCount: true,
          successCount: true,
          failureCount: true,
          duplicateCount: true,
        },
      });
      if (current?.status === "CANCELLED") {
        return toQueueResult(
          databaseJob.id,
          {
            processedCount: current.processedCount,
            successCount: current.successCount,
            failureCount: current.failureCount,
            duplicateCount: current.duplicateCount,
          },
          current.cancelledAt ?? new Date(),
        );
      }
      throw new UnrecoverableError("SCRAPING_JOB_START_TRANSITION_FAILED");
    }
    await job.updateProgress(lastProgress);

    const getCancellationState = async (): Promise<boolean> => {
      const current = await prisma.scrapingJob.findUnique({
        where: { id: databaseJob.id },
        select: { userId: true, status: true },
      });
      if (!current || current.userId !== job.data.requestedById) {
        throw new UnrecoverableError("SCRAPING_JOB_OWNERSHIP_MISMATCH");
      }
      if (current.status === "CANCELLED") return true;
      if (current.status !== "RUNNING") {
        throw new UnrecoverableError("SCRAPING_JOB_NOT_RUNNING");
      }
      return false;
    };

    const result = await runScraping(
      {
        scrapingJobId: databaseJob.id,
        sourceKey: SOURCE_KEY_BY_PUBLIC_SOURCE[effectivePublicSource],
        country: authoritativeCountry,
        searchQuery: authoritativeSearchQuery,
        requestedLimit: Math.min(databaseJob.requestedLimit, 100),
        requestPolicy: {
          requestsPerMinute: sourcePolicy.requestsPerMinute,
          maxConcurrency: sourcePolicy.maxConcurrency,
        },
        ...(databaseJob.state ? { state: databaseJob.state } : {}),
        ...(databaseJob.city ? { city: databaseJob.city } : {}),
        ...(databaseJob.category ? { category: databaseJob.category } : {}),
      },
      {
        userId: job.data.requestedById,
        shouldCancel: getCancellationState,
        onProgress: async (progress, counts) => {
          const nextProgress = Math.min(Math.max(Math.round(progress), lastProgress), 99);
          const updated = await prisma.scrapingJob.updateMany({
            where: {
              id: databaseJob.id,
              userId: job.data.requestedById,
              status: "RUNNING",
            },
            data: {
              ...counts,
              progressPercentage: nextProgress,
            },
          });
          if (updated.count === 0) {
            if (await getCancellationState()) return false;
            throw new UnrecoverableError("SCRAPING_JOB_PROGRESS_UPDATE_REJECTED");
          }
          lastProgress = nextProgress;
          await job.updateProgress(nextProgress);
          return true;
        },
      },
    );

    const finalCounts: JobCounts = {
      processedCount: result.processedCount,
      successCount: result.successCount,
      failureCount: result.failureCount,
      duplicateCount: result.duplicateCount,
    };
    if (result.cancelled) {
      return synchronizeCancelledCounts(job.data, finalCounts);
    }

    const completedAt = new Date();
    const completion = await prisma.scrapingJob.updateMany({
      where: {
        id: databaseJob.id,
        userId: job.data.requestedById,
        status: "RUNNING",
      },
      data: {
        status: "COMPLETED",
        ...finalCounts,
        progressPercentage: 100,
        completedAt,
        errorMessage: null,
      },
    });

    if (completion.count === 0) {
      const current = await prisma.scrapingJob.findUnique({
        where: { id: databaseJob.id },
        select: { status: true },
      });
      if (current?.status === "CANCELLED") {
        return synchronizeCancelledCounts(job.data, finalCounts);
      }
      throw new UnrecoverableError("SCRAPING_JOB_COMPLETION_REJECTED");
    }

    await job.updateProgress(100);
    return toQueueResult(databaseJob.id, finalCounts, completedAt);
  } catch (error: unknown) {
    let finalError = error;
    if (activeSourceKey && error instanceof ScraperError) {
      const blockedCodes = new Set([
        "ROBOTS_DISALLOWED",
        "SOURCE_AUTHORIZATION_DENIED",
        "AUTOMATION_PROHIBITED",
      ]);
      const reviewCodes = new Set([
        "CAPTCHA_DETECTED",
        "LOGIN_WALL",
        "CONSENT_WALL",
        "RATE_LIMIT_REJECTED",
      ]);
      if (blockedCodes.has(error.code)) {
        await markSourceBlocked(activeSourceKey, error.message).catch(
          () => undefined,
        );
        finalError = new UnrecoverableError(error.code);
      } else if (reviewCodes.has(error.code)) {
        await markSourceReviewRequired(activeSourceKey, error.message).catch(
          () => undefined,
        );
        finalError = new UnrecoverableError(error.code);
      }
    }
    if (ownerVerified && isFinalAttempt(job, finalError)) {
      await prisma.scrapingJob
        .updateMany({
          where: {
            id: job.data.scrapingJobId,
            userId: job.data.requestedById,
            status: { in: [...ACTIVE_JOB_STATUSES] },
          },
          data: {
            status: "FAILED",
            failedAt: new Date(),
            errorMessage: getSafeScrapingFailureMessage(error),
          },
        })
        .catch(() => undefined);
    }
    throw finalError;
  }
};
