import { Redis, type RedisOptions } from "ioredis";

import { logger } from "../../common/logger/logger.js";
import { env } from "../../config/env.js";

const options: RedisOptions = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  db: env.REDIS_DB,
  maxRetriesPerRequest: null,
  enableReadyCheck: true,
};

if (env.REDIS_USERNAME) options.username = env.REDIS_USERNAME;
if (env.REDIS_PASSWORD) options.password = env.REDIS_PASSWORD;

export const workerRedis = new Redis(options);

workerRedis.on("error", (error: Error) => {
  logger.error({ errorType: error.name }, "Worker Redis connection error");
});

export const disconnectWorkerRedis = async (): Promise<void> => {
  if (workerRedis.status !== "end") await workerRedis.quit();
};
