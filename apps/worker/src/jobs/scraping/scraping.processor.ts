import type { Job } from "bullmq";
import type {
  ScrapingJobName,
  ScrapingJobQueueData,
  ScrapingJobQueueResult,
} from "@lead-saas/shared-types";

import { prisma } from "../../infrastructure/database/prisma.js";
import { runScraping } from "../../modules/scraping/services/scraping.service.js";

export const processScrapingJob = async (
  job: Job<ScrapingJobQueueData, ScrapingJobQueueResult, ScrapingJobName>,
): Promise<ScrapingJobQueueResult> => {
  const databaseJob = await prisma.scrapingJob.findUnique({ where: { id: job.data.scrapingJobId } });
  if (!databaseJob) throw new Error("SCRAPING_JOB_NOT_FOUND");

  await prisma.scrapingJob.update({
    where: { id: job.data.scrapingJobId },
    data: { status: "RUNNING", startedAt: new Date(), failureReason: null, progress: 5 },
  });
  await job.updateProgress(5);

  const result = await runScraping(
    {
      scrapingJobId: job.data.scrapingJobId,
      sourceKey: job.data.sourceKey,
      country: job.data.country,
      searchQuery: job.data.searchQuery,
      requestedLimit: Math.min(job.data.requestedLimit, 100),
      ...(job.data.state ? { state: job.data.state } : {}),
      ...(job.data.city ? { city: job.data.city } : {}),
      ...(job.data.category ? { category: job.data.category } : {}),
    },
    async (progress, counts) => {
      await job.updateProgress(progress);
      await prisma.scrapingJob.update({
        where: { id: job.data.scrapingJobId },
        data: { ...counts, progress },
      });
    },
  );

  const completedAt = new Date();
  await job.updateProgress(100);
  await prisma.scrapingJob.update({
    where: { id: job.data.scrapingJobId },
    data: {
      status: "COMPLETED",
      processedCount: result.processedCount,
      collectedCount: result.collectedCount,
      failedCount: result.failedCount,
      progress: 100,
      completedAt,
    },
  });

  return {
    scrapingJobId: job.data.scrapingJobId,
    processedCount: result.processedCount,
    collectedCount: result.collectedCount,
    failedCount: result.failedCount,
    skippedCount: result.skippedCount,
    completedAt: completedAt.toISOString(),
  };
};
