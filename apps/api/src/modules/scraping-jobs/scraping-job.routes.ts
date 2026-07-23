import { Router } from "express";

import { logger } from "../../common/logger/logger.js";
import {
  createTestScrapingJobSchema,
  scrapingJobIdSchema,
} from "./scraping-job.schemas.js";
import { createAndEnqueueTestJob, getScrapingJob } from "./scraping-job.service.js";

export const scrapingJobRouter = Router();

scrapingJobRouter.post("/test", async (request, response) => {
  const parsed = createTestScrapingJobSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({
      success: false,
      message: "Request validation failed",
      error: { code: "VALIDATION_ERROR", issues: parsed.error.issues },
    });
    return;
  }

  try {
    const result = await createAndEnqueueTestJob(parsed.data);
    response.status(202).json({
      success: true,
      message: "Test scraping job queued successfully",
      data: { ...result, status: "QUEUED" },
    });
  } catch (error: unknown) {
    const missingUser = error instanceof Error && error.message === "DEVELOPMENT_SYSTEM_USER_MISSING";
    const sourceNotPermitted = error instanceof Error && error.message === "SOURCE_NOT_PERMITTED";
    logger.error({ operation: "enqueue-test-job" }, "Test job enqueue failed");
    response.status(sourceNotPermitted ? 400 : 503).json({
      success: false,
      message: sourceNotPermitted
        ? "Requested scraping source is not enabled"
        : missingUser
        ? "Development system user is not seeded"
        : "Test scraping job could not be queued",
      error: {
        code: sourceNotPermitted
          ? "SOURCE_NOT_PERMITTED"
          : missingUser
            ? "SYSTEM_USER_MISSING"
            : "QUEUE_UNAVAILABLE",
      },
    });
  }
});

scrapingJobRouter.get("/:id", async (request, response) => {
  const parsedId = scrapingJobIdSchema.safeParse(request.params.id);
  if (!parsedId.success) {
    response.status(400).json({
      success: false,
      message: "Scraping job ID must be a valid UUID",
      error: { code: "INVALID_JOB_ID" },
    });
    return;
  }

  const job = await getScrapingJob(parsedId.data);
  if (!job) {
    response.status(404).json({
      success: false,
      message: "Scraping job was not found",
      error: { code: "SCRAPING_JOB_NOT_FOUND" },
    });
    return;
  }
  response.status(200).json({ success: true, data: job });
});
