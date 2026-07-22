import { Router } from "express";

import { logger } from "../../common/logger/logger.js";
import { prisma } from "../../infrastructure/database/prisma.js";

export const healthRouter = Router();

healthRouter.get("/", async (_request, response) => {
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;
    response.status(200).json({
      success: true,
      message: "US Business Lead SaaS API is healthy",
      data: {
        service: "api",
        status: "healthy",
        database: "connected",
        timestamp,
      },
    });
  } catch (error: unknown) {
    const errorType = error instanceof Error ? error.name : "UnknownError";
    logger.error({ errorType }, "Database health check failed");
    response.status(503).json({
      success: false,
      message: "US Business Lead SaaS API is unhealthy",
      data: {
        service: "api",
        status: "unhealthy",
        database: "disconnected",
        timestamp,
      },
    });
  }
});
