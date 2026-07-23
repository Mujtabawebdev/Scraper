import type {
  CsvImportJobName,
  CsvImportQueueData,
  CsvImportQueueResult,
} from "@lead-saas/shared-types";
import { Queue } from "bullmq";

import { env } from "../../config/env.js";
import { createRedisConnectionOptions } from "../redis/redis.connection.js";
import { scrapingJobDefaultOptions } from "./queue.options.js";

export const CSV_IMPORT_JOB_NAME: CsvImportJobName = "import-business-csv";

export const csvImportQueue = new Queue<
  CsvImportQueueData,
  CsvImportQueueResult,
  CsvImportJobName
>(env.CSV_IMPORT_QUEUE_NAME, {
  connection: createRedisConnectionOptions(),
  prefix: env.QUEUE_PREFIX,
  defaultJobOptions: scrapingJobDefaultOptions,
});

export const enqueueCsvImport = async (data: CsvImportQueueData) =>
  csvImportQueue.add(CSV_IMPORT_JOB_NAME, data, { jobId: data.importId });
