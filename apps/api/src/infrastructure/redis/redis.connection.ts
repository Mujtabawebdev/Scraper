import { Redis, type RedisOptions } from "ioredis";

import { logger } from "../../common/logger/logger.js";
import { env } from "../../config/env.js";

export const createRedisConnectionOptions = (
  workerConnection = false,
): RedisOptions => {
  const options: RedisOptions = {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    db: env.REDIS_DB,
    maxRetriesPerRequest: workerConnection ? null : env.REDIS_MAX_RETRIES_PER_REQUEST,
    enableReadyCheck: true,
    connectTimeout: 3_000,
  };

  if (env.REDIS_USERNAME) options.username = env.REDIS_USERNAME;
  if (env.REDIS_PASSWORD) options.password = env.REDIS_PASSWORD;

  return options;
};

export const createRedisClient = (lazyConnect = true): Redis => {
  const client = new Redis({ ...createRedisConnectionOptions(), lazyConnect });
  client.on("error", (error: Error) => {
    logger.error({ errorType: error.name }, "Redis client error");
  });
  return client;
};
