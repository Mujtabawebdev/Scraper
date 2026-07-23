import type { ScrapingJobQueueData } from "@lead-saas/shared-types";

import { prisma } from "../../infrastructure/database/prisma.js";
import { enqueueScrapingJob } from "../../infrastructure/queue/scraping.queue.js";
import { env } from "../../config/env.js";
import type { z } from "zod";
import type { createTestScrapingJobSchema } from "./scraping-job.schemas.js";

const SYSTEM_USER_EMAIL = "system@lead-saas.local";

export type CreateTestScrapingJobInput = z.infer<typeof createTestScrapingJobSchema>;

export const createAndEnqueueTestJob = async (input: CreateTestScrapingJobInput) => {
  if (
    input.sourceKey === "permitted-http-directory" &&
    (!env.SCRAPING_EXTERNAL_SOURCE_ENABLED || !env.SCRAPING_APPROVED_BASE_URL)
  ) {
    throw new Error("SOURCE_NOT_PERMITTED");
  }
  const systemUser = await prisma.user.findUnique({ where: { email: SYSTEM_USER_EMAIL } });
  if (!systemUser) throw new Error("DEVELOPMENT_SYSTEM_USER_MISSING");

  const databaseJob = await prisma.scrapingJob.create({
    data: {
      name: `POC: ${input.searchQuery}`.slice(0, 150),
      country: input.country,
      searchQuery: input.searchQuery,
      requestedLimit: input.requestedLimit,
      status: "PENDING",
      createdById: systemUser.id,
      ...(input.state ? { state: input.state } : {}),
      ...(input.city ? { city: input.city } : {}),
      ...(input.category ? { category: input.category } : {}),
    },
  });

  const queueData: ScrapingJobQueueData = {
    scrapingJobId: databaseJob.id,
    sourceKey: input.sourceKey,
    country: input.country,
    searchQuery: input.searchQuery,
    requestedLimit: input.requestedLimit,
    requestedById: systemUser.id,
    ...(input.state ? { state: input.state } : {}),
    ...(input.city ? { city: input.city } : {}),
    ...(input.category ? { category: input.category } : {}),
  };

  try {
    const queueJob = await enqueueScrapingJob(queueData);
    await prisma.scrapingJob.update({
      where: { id: databaseJob.id },
      data: { status: "QUEUED" },
    });
    return { scrapingJobId: databaseJob.id, queueJobId: queueJob.id };
  } catch {
    await prisma.scrapingJob.update({
      where: { id: databaseJob.id },
      data: { status: "FAILED", failureReason: "Queue submission failed" },
    });
    throw new Error("QUEUE_SUBMISSION_FAILED");
  }
};

export const getScrapingJob = async (id: string) =>
  prisma.scrapingJob.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      country: true,
      state: true,
      city: true,
      category: true,
      searchQuery: true,
      requestedLimit: true,
      collectedCount: true,
      processedCount: true,
      failedCount: true,
      progress: true,
      status: true,
      startedAt: true,
      completedAt: true,
      failureReason: true,
      createdAt: true,
      updatedAt: true,
    },
  });
