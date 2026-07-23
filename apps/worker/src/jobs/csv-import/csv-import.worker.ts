import type {
  CsvImportJobName,
  CsvImportQueueData,
  CsvImportQueueResult,
} from "@lead-saas/shared-types";
import { Worker } from "bullmq";

import { logger } from "../../common/logger/logger.js";
import { env } from "../../config/env.js";
import { workerRedis } from "../../infrastructure/redis/redis.connection.js";
import { processCsvImport } from "./csv-import.processor.js";

export const csvImportWorker = new Worker<
  CsvImportQueueData,
  CsvImportQueueResult,
  CsvImportJobName
>(env.CSV_IMPORT_QUEUE_NAME, processCsvImport, {
  connection: workerRedis,
  prefix: env.QUEUE_PREFIX,
  concurrency: 1,
});

csvImportWorker.on("completed", (job) => {
  logger.info({ importId: job.data.importId }, "CSV import completed");
});
csvImportWorker.on("failed", (job, error) => {
  logger.error(
    { importId: job?.data.importId, errorType: error.name },
    "CSV import failed",
  );
});
csvImportWorker.on("error", (error) => {
  logger.error({ errorType: error.name }, "CSV import worker error");
});
