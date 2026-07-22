import type { Job } from "bullmq";
import type {
  ScrapingJobName,
  ScrapingJobQueueData,
  ScrapingJobQueueResult,
} from "@lead-saas/shared-types";

import { prisma } from "../../infrastructure/database/prisma.js";

const delay = async (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export const processScrapingJob = async (
  job: Job<ScrapingJobQueueData, ScrapingJobQueueResult, ScrapingJobName>,
): Promise<ScrapingJobQueueResult> => {
  const requestedLimit = Math.min(job.data.requestedLimit, 100);

  await prisma.scrapingJob.update({
    where: { id: job.data.scrapingJobId },
    data: { status: "RUNNING", startedAt: new Date(), failureReason: null },
  });

  let processedCount = 0;
  const batchSize = 2;

  while (processedCount < requestedLimit) {
    processedCount = Math.min(processedCount + batchSize, requestedLimit);
    const progress = Math.round((processedCount / requestedLimit) * 100);

    await job.updateProgress(progress);
    await prisma.scrapingJob.update({
      where: { id: job.data.scrapingJobId },
      data: {
        processedCount,
        collectedCount: processedCount,
        failedCount: 0,
        progress,
      },
    });
    await delay(200);
  }

  const completedAt = new Date();
  await prisma.scrapingJob.update({
    where: { id: job.data.scrapingJobId },
    data: {
      status: "COMPLETED",
      processedCount,
      collectedCount: processedCount,
      failedCount: 0,
      progress: 100,
      completedAt,
    },
  });

  return {
    scrapingJobId: job.data.scrapingJobId,
    processedCount,
    collectedCount: processedCount,
    failedCount: 0,
    completedAt: completedAt.toISOString(),
  };
};
