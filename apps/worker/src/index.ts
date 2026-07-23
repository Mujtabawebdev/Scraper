import { logger } from "./common/logger/logger.js";
import { env } from "./config/env.js";
import { disconnectDatabase } from "./infrastructure/database/prisma.js";
import { disconnectWorkerRedis } from "./infrastructure/redis/redis.connection.js";
import { scrapingWorker } from "./jobs/scraping/scraping.worker.js";
import { csvImportWorker } from "./jobs/csv-import/csv-import.worker.js";

let isShuttingDown = false;

const shutdown = async (reason: string, exitCode = 0): Promise<void> => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ reason }, "Worker shutdown requested");

  let finalExitCode = exitCode;
  try {
    await Promise.all([scrapingWorker.close(), csvImportWorker.close()]);
    await disconnectWorkerRedis();
    await disconnectDatabase();
    logger.info("Worker resources disconnected");
  } catch (error: unknown) {
    finalExitCode = 1;
    logger.error(
      { errorType: error instanceof Error ? error.name : "UnknownError" },
      "Worker shutdown failed",
    );
  }
  process.exit(finalExitCode);
};

process.once("SIGINT", (signal) => void shutdown(signal));
process.once("SIGTERM", (signal) => void shutdown(signal));
process.on("uncaughtException", (error) => {
  logger.fatal({ errorType: error.name }, "Uncaught worker exception");
  void shutdown("uncaughtException", 1);
});
process.on("unhandledRejection", (reason) => {
  const errorType = reason instanceof Error ? reason.name : "UnknownError";
  logger.fatal({ errorType }, "Unhandled worker rejection");
  void shutdown("unhandledRejection", 1);
});

logger.info(
  {
    scrapingQueue: env.SCRAPING_QUEUE_NAME,
    csvImportQueue: env.CSV_IMPORT_QUEUE_NAME,
    concurrency: env.WORKER_CONCURRENCY,
  },
  "Acquisition workers started",
);
