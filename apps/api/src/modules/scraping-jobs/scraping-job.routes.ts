import { Router } from "express";

import { authenticate } from "../../common/middleware/authenticate.middleware.js";
import {
  jobCreationRateLimiter,
  jobRetryRateLimiter,
} from "../../common/middleware/resource-rate-limit.middleware.js";
import {
  cancel,
  create,
  createTest,
  detail,
  list,
  retry,
} from "./scraping-job.controller.js";

export const scrapingJobRouter = Router();

scrapingJobRouter.use(authenticate);
scrapingJobRouter.post("/", jobCreationRateLimiter, create);
scrapingJobRouter.post("/test", jobCreationRateLimiter, createTest);
scrapingJobRouter.get("/", list);
scrapingJobRouter.get("/:jobId", detail);
scrapingJobRouter.post("/:jobId/cancel", cancel);
scrapingJobRouter.post("/:jobId/retry", jobRetryRateLimiter, retry);
