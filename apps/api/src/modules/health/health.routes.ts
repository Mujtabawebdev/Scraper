import { Router } from "express";

import { logger } from "../../common/logger/logger.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { checkRedisHealth } from "../../infrastructure/redis/redis.health.js";

export const healthRouter = Router();

healthRouter.get("/", async (_request, response) => {
  const [databaseResult, redisResult] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    checkRedisHealth(),
  ]);
  const database = databaseResult.status === "fulfilled" ? "connected" : "disconnected";
  const redis = redisResult.status === "fulfilled" ? "connected" : "disconnected";
  const healthy = database === "connected" && redis === "connected";

  if (databaseResult.status === "rejected") {
    logger.error({ dependency: "database" }, "Health dependency check failed");
  }
  if (redisResult.status === "rejected") {
    logger.error({ dependency: "redis" }, "Health dependency check failed");
  }

  response.status(healthy ? 200 : 503).json({
    success: healthy,
    message: healthy
      ? "US Business Lead SaaS API is healthy"
      : "US Business Lead SaaS API is unhealthy",
    data: {
      service: "api",
      status: healthy ? "healthy" : "unhealthy",
      database,
      redis,
      timestamp: new Date().toISOString(),
    },
  });
});
