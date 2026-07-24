import { Router, type Request, type Response } from "express";

import { logger } from "../../common/logger/logger.js";
import { env } from "../../config/env.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { getPrometheusMetricsString, getSystemMetrics } from "../../infrastructure/metrics/metrics.service.js";
import { checkQueueHealth } from "../../infrastructure/queue/queue.health.js";
import { checkRedisHealth } from "../../infrastructure/redis/redis.health.js";

export const healthRouter = Router();

healthRouter.get("/", async (_request: Request, response: Response) => {
  const [databaseResult, redisResult, queueResult] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    checkRedisHealth(),
    checkQueueHealth(),
  ]);

  const database = databaseResult.status === "fulfilled" ? "connected" : "disconnected";
  const redis = redisResult.status === "fulfilled" ? "connected" : "disconnected";
  const queues = queueResult.status === "fulfilled" ? queueResult.value : null;

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
      queues: queues?.queues ?? null,
      timestamp: new Date().toISOString(),
    },
  });
});

healthRouter.get("/liveness", (_request: Request, response: Response) => {
  response.status(200).json({
    success: true,
    message: "Service is alive",
    data: { status: "alive", timestamp: new Date().toISOString() },
  });
});

healthRouter.get("/readiness", async (_request: Request, response: Response) => {
  const [databaseResult, redisResult] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    checkRedisHealth(),
  ]);

  const databaseReady = databaseResult.status === "fulfilled";
  const redisReady = redisResult.status === "fulfilled";
  const isReady = databaseReady && redisReady;

  response.status(isReady ? 200 : 503).json({
    success: isReady,
    message: isReady ? "Service is ready to receive traffic" : "Service is not ready",
    data: {
      status: isReady ? "ready" : "not_ready",
      database: databaseReady ? "ready" : "not_ready",
      redis: redisReady ? "ready" : "not_ready",
      timestamp: new Date().toISOString(),
    },
  });
});

healthRouter.get("/metrics", async (request: Request, response: Response) => {
  if (env.METRICS_BEARER_TOKEN) {
    const authHeader = request.get("authorization");
    if (authHeader !== `Bearer ${env.METRICS_BEARER_TOKEN}`) {
      response.status(401).json({
        success: false,
        message: "Metrics endpoint authentication required",
        error: { code: "AUTHENTICATION_REQUIRED" },
      });
      return;
    }
  }

  const metrics = await getSystemMetrics();
  const acceptHeader = request.get("accept") ?? "";
  const formatQuery = request.query.format;

  if (formatQuery === "prometheus" || acceptHeader.includes("text/plain")) {
    response.setHeader("Content-Type", "text/plain; version=0.0.4");
    response.status(200).send(getPrometheusMetricsString(metrics));
    return;
  }

  response.status(200).json({
    success: true,
    message: "Metrics retrieved successfully",
    data: metrics,
  });
});
