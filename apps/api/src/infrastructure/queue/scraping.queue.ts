import { Queue } from "bullmq";
import type {
  ScrapingJobName,
  ScrapingJobQueueData,
  ScrapingJobQueueResult,
} from "@lead-saas/shared-types";

import { env } from "../../config/env.js";
import { createRedisConnectionOptions } from "../redis/redis.connection.js";
import { scrapingJobDefaultOptions } from "./queue.options.js";

export const SCRAPING_JOB_NAME: ScrapingJobName = "scrape-businesses";

export const scrapingQueue = new Queue<
  ScrapingJobQueueData,
  ScrapingJobQueueResult,
  ScrapingJobName
>(env.SCRAPING_QUEUE_NAME, {
  connection: createRedisConnectionOptions(),
  prefix: env.QUEUE_PREFIX,
  defaultJobOptions: scrapingJobDefaultOptions,
});

export const enqueueScrapingJob = async (data: ScrapingJobQueueData) =>
  scrapingQueue.add(SCRAPING_JOB_NAME, data, { jobId: data.scrapingJobId });
