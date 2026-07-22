import type { Server } from "node:http";

import { app } from "./app.js";
import { logger } from "./common/logger/logger.js";
import { env } from "./config/env.js";
import { disconnectDatabase } from "./infrastructure/database/prisma.js";

let server: Server | undefined;
let isShuttingDown = false;

const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, "Shutdown requested");

  let exitCode = 0;

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
    logger.error({ err: error }, "Failed to disconnect database resources");
  }

  process.exit(exitCode);
};

process.once("SIGINT", (signal) => void shutdown(signal));
process.once("SIGTERM", (signal) => void shutdown(signal));
process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "Unhandled rejection");
  process.exit(1);
});

server = app.listen(env.API_PORT, () => {
  logger.info({ port: env.API_PORT, environment: env.NODE_ENV }, "API server started");
});
server.on("error", (error) => {
  logger.fatal({ err: error }, "API server failed to start");
  process.exit(1);
});
