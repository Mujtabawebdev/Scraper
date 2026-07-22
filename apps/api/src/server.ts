import type { Server } from "node:http";

import { app } from "./app.js";
import { logger } from "./common/logger/logger.js";
import { env } from "./config/env.js";
import { disconnectDatabase } from "./infrastructure/database/prisma.js";
import { closeQueues } from "./infrastructure/queue/queue.shutdown.js";
import { disconnectRedisHealthClient } from "./infrastructure/redis/redis.health.js";

let server: Server | undefined;
let isShuttingDown = false;

const shutdown = async (reason: string, requestedExitCode = 0): Promise<void> => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ reason }, "Shutdown requested");

  let exitCode = requestedExitCode;

  try {
    await closeQueues();
    await disconnectRedisHealthClient();
    logger.info("Queue and Redis resources disconnected");
  } catch (error: unknown) {
    exitCode = 1;
    logger.error({ errorType: error instanceof Error ? error.name : "UnknownError" }, "Failed to close queue resources");
  }

  try {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => (error ? reject(error) : resolve()));
      });
      logger.info("HTTP server closed");
    }
  } catch (error: unknown) {
    exitCode = 1;
    logger.error({ err: error }, "Failed to close HTTP server");
  }

  try {
    await disconnectDatabase();
    logger.info("Database resources disconnected");
  } catch (error: unknown) {
    exitCode = 1;
    logger.error(
      { errorType: error instanceof Error ? error.name : "UnknownError" },
      "Failed to disconnect database resources",
    );
  }

  process.exit(exitCode);
};

process.once("SIGINT", (signal) => void shutdown(signal));
process.once("SIGTERM", (signal) => void shutdown(signal));
process.on("uncaughtException", (error) => {
  logger.fatal({ errorType: error.name }, "Uncaught exception");
  void shutdown("uncaughtException", 1);
});
process.on("unhandledRejection", (reason) => {
  const errorType = reason instanceof Error ? reason.name : "UnknownError";
  logger.fatal({ errorType }, "Unhandled rejection");
  void shutdown("unhandledRejection", 1);
});

server = app.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT, environment: env.NODE_ENV }, "API server started");
});
server.on("error", (error) => {
  logger.fatal({ errorType: error.name }, "API server failed to start");
  void shutdown("serverError", 1);
});
