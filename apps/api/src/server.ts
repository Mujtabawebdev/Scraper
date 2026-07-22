import type { Server } from "node:http";

import { app } from "./app.js";
import { logger } from "./common/logger/logger.js";
import { env } from "./config/env.js";

let server: Server | undefined;
let isShuttingDown = false;

const shutdown = (signal: NodeJS.Signals): void => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  logger.info({ signal }, "Shutdown requested");

  if (!server) process.exit(0);
  server.close((error) => {
    if (error) {
      logger.error({ err: error }, "Failed to close HTTP server");
      process.exit(1);
    }
    logger.info("HTTP server closed");
    process.exit(0);
  });
};

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
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
