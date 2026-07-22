import { Worker } from "bullmq";
import type {
  ScrapingJobName,
  ScrapingJobQueueData,
  ScrapingJobQueueResult,
} from "@lead-saas/shared-types";

import { logger } from "../../common/logger/logger.js";
import { env } from "../../config/env.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { workerRedis } from "../../infrastructure/redis/redis.connection.js";
import { processScrapingJob } from "./scraping.processor.js";

export const scrapingWorker = new Worker<
  ScrapingJobQueueData,
  ScrapingJobQueueResult,
  ScrapingJobName
>(env.SCRAPING_QUEUE_NAME, processScrapingJob, {
  connection: workerRedis,
  prefix: env.QUEUE_PREFIX,
  concurrency: env.WORKER_CONCURRENCY,
});

scrapingWorker.on("active", (job) => {
  logger.info({ jobId: job.id }, "Scraping job active");
});
scrapingWorker.on("progress", (job, progress) => {
  logger.debug({ jobId: job.id, progress }, "Scraping job progress updated");
});
scrapingWorker.on("completed", (job) => {
  logger.info({ jobId: job.id }, "Scraping job completed");
});
scrapingWorker.on("failed", (job, error) => {
  const attempts = job?.opts.attempts ?? 1;
  const finalAttempt = job ? job.attemptsMade >= attempts : true;
  logger.error(
    { jobId: job?.id, finalAttempt, errorType: error.name },
    "Scraping job attempt failed",
  );

  if (job && finalAttempt) {
    void prisma.scrapingJob
      .update({
        where: { id: job.data.scrapingJobId },
        data: { status: "FAILED", failureReason: "Mock job processing failed" },
      })
      .catch(() => logger.error({ jobId: job.id }, "Failed to synchronize final job failure"));
  }
});
scrapingWorker.on("stalled", (jobId) => {
  logger.warn({ jobId }, "Scraping job stalled");
});
scrapingWorker.on("error", (error) => {
  logger.error({ errorType: error.name }, "Scraping worker error");
});
