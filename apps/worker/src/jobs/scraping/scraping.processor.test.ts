import type {
  ScrapingJobName,
  ScrapingJobQueueData,
  ScrapingJobQueueResult,
} from "@lead-saas/shared-types";
import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

const processorMocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  runScraping: vi.fn(),
}));

vi.mock("../../infrastructure/database/prisma.js", () => ({
  prisma: {
    scrapingJob: {
      findUnique: processorMocks.findUnique,
      updateMany: processorMocks.updateMany,
    },
  },
}));

vi.mock("../../modules/scraping/services/scraping.service.js", () => ({
  runScraping: processorMocks.runScraping,
}));

import { processScrapingJob } from "./scraping.processor.js";

const scrapingJobId = "00000000-0000-4000-8000-000000000010";
const userId = "00000000-0000-4000-8000-000000000011";

const databaseJob = {
  id: scrapingJobId,
  userId,
  source: "fixture-business-directory",
  country: "United States",
  state: "TX",
  city: "Austin",
  category: "Plumbing",
  searchQuery: "authoritative database query",
  requestedLimit: 17,
  status: "QUEUED",
  queueJobId: scrapingJobId,
  processedCount: 0,
  successCount: 0,
  failureCount: 0,
  duplicateCount: 0,
  progressPercentage: 0,
  startedAt: null,
  completedAt: null,
  failedAt: null,
  cancelledAt: null,
};

const queueData: ScrapingJobQueueData = {
  scrapingJobId,
  source: "fixture-business-directory",
  sourceKey: "fixture-directory",
  country: "Queue Country",
  state: "CA",
  city: "Queue City",
  category: "Queue Category",
  searchQuery: "mutable queue query",
  requestedLimit: 99,
  requestedById: userId,
};

const completedResult = {
  processedCount: 3,
  successCount: 2,
  failureCount: 0,
  duplicateCount: 1,
  pagesProcessed: 1,
  cancelled: false,
};

const makeJob = (
  data: ScrapingJobQueueData = queueData,
  id: string = scrapingJobId,
  attemptsMade = 0,
): {
  job: Job<ScrapingJobQueueData, ScrapingJobQueueResult, ScrapingJobName>;
  updateProgress: ReturnType<typeof vi.fn>;
} => {
  const updateProgress = vi.fn().mockResolvedValue(undefined);
  return {
    job: {
      id,
      data,
      opts: { attempts: 3 },
      attemptsMade,
      updateProgress,
    } as unknown as Job<
      ScrapingJobQueueData,
      ScrapingJobQueueResult,
      ScrapingJobName
    >,
    updateProgress,
  };
};

describe("processScrapingJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processorMocks.findUnique.mockResolvedValue(databaseJob);
    processorMocks.updateMany.mockResolvedValue({ count: 1 });
    processorMocks.runScraping.mockResolvedValue(completedResult);
  });

  it("executes only authoritative database scraping parameters", async () => {
    const { job } = makeJob();

    await processScrapingJob(job);

    expect(processorMocks.runScraping).toHaveBeenCalledWith(
      {
        scrapingJobId,
        sourceKey: "fixture-directory",
        country: "United States",
        state: "TX",
        city: "Austin",
        category: "Plumbing",
        searchQuery: "authoritative database query",
        requestedLimit: 17,
      },
      expect.objectContaining({ userId }),
    );
  });

  it("rejects a queue owner mismatch without mutating the database job", async () => {
    processorMocks.findUnique.mockResolvedValue({
      ...databaseJob,
      userId: "00000000-0000-4000-8000-000000000099",
    });
    const { job } = makeJob();

    await expect(processScrapingJob(job)).rejects.toThrow(
      "SCRAPING_JOB_OWNERSHIP_MISMATCH",
    );

    expect(processorMocks.updateMany).not.toHaveBeenCalled();
    expect(processorMocks.runScraping).not.toHaveBeenCalled();
  });

  it("requires the Bull job ID to equal the database job ID", async () => {
    const { job } = makeJob(
      queueData,
      "00000000-0000-4000-8000-000000000098",
    );

    await expect(processScrapingJob(job)).rejects.toThrow(
      "SCRAPING_QUEUE_JOB_ID_MISMATCH",
    );

    expect(processorMocks.updateMany).not.toHaveBeenCalled();
    expect(processorMocks.runScraping).not.toHaveBeenCalled();
  });

  it("rejects a source mismatch before invoking an adapter", async () => {
    const { job } = makeJob({
      ...queueData,
      source: "permitted-http-directory",
      sourceKey: "permitted-http-directory",
    });

    await expect(processScrapingJob(job)).rejects.toThrow(
      "SCRAPING_JOB_SOURCE_MISMATCH",
    );

    expect(processorMocks.runScraping).not.toHaveBeenCalled();
    expect(processorMocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: scrapingJobId, userId }),
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });

  it("normalizes only allowlisted legacy source and queue metadata", async () => {
    processorMocks.findUnique.mockResolvedValue({
      ...databaseJob,
      queueJobId: null,
    });
    const { source: _source, ...legacyData } = queueData;
    const { job } = makeJob({
      ...legacyData,
      sourceKey: "permitted-http-directory",
    } as ScrapingJobQueueData);

    await processScrapingJob(job);

    expect(processorMocks.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          id: scrapingJobId,
          userId,
          status: { in: ["PENDING", "QUEUED", "RUNNING"] },
        }),
        data: {
          source: "permitted-http-directory",
          queueJobId: scrapingJobId,
        },
      }),
    );
    expect(processorMocks.runScraping).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceKey: "permitted-http-directory",
        country: databaseJob.country,
        searchQuery: databaseJob.searchQuery,
        requestedLimit: databaseJob.requestedLimit,
      }),
      expect.any(Object),
    );
  });

  it("does not overwrite cancellation when it wins the completion race", async () => {
    const cancelledAt = new Date("2026-07-23T18:00:00.000Z");
    processorMocks.findUnique
      .mockResolvedValueOnce(databaseJob)
      .mockResolvedValueOnce({ status: "CANCELLED" })
      .mockResolvedValueOnce({ cancelledAt });
    processorMocks.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });
    const { job, updateProgress } = makeJob();

    const result = await processScrapingJob(job);

    expect(result).toEqual({
      scrapingJobId,
      processedCount: 3,
      successCount: 2,
      failureCount: 0,
      duplicateCount: 1,
      completedAt: cancelledAt.toISOString(),
    });
    expect(processorMocks.updateMany).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        where: { id: scrapingJobId, userId, status: "CANCELLED" },
        data: {
          processedCount: 3,
          successCount: 2,
          failureCount: 0,
          duplicateCount: 1,
        },
      }),
    );
    expect(updateProgress).not.toHaveBeenCalledWith(100);
  });

  it("marks only an active owned job failed on its terminal attempt", async () => {
    const processingError = new Error("private database details");
    processorMocks.runScraping.mockRejectedValue(processingError);
    const { job } = makeJob(queueData, scrapingJobId, 2);

    await expect(processScrapingJob(job)).rejects.toBe(processingError);

    expect(processorMocks.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          id: scrapingJobId,
          userId,
          status: { in: ["PENDING", "QUEUED", "RUNNING"] },
        },
        data: expect.objectContaining({
          status: "FAILED",
          failedAt: expect.any(Date),
          errorMessage: "The scraping job could not be completed",
        }),
      }),
    );
  });
});
