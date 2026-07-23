import type { Request, Response } from "express";
import type { ZodType } from "zod";

import { AppError } from "../../common/errors/app-error.js";
import { authenticationRequiredError } from "../auth/auth.errors.js";
import { approvedSourceRequiredError } from "./scraping-job.errors.js";
import {
  createScrapingJobSchema,
  createTestScrapingJobSchema,
  listScrapingJobsQuerySchema,
  scrapingJobParamsSchema,
} from "./scraping-job.schemas.js";
import {
  cancelScrapingJob,
  createAndEnqueueTestJob,
  createScrapingJob,
  getScrapingJob,
  listScrapingJobs,
  retryScrapingJob,
} from "./scraping-job.service.js";

const parse = <Output>(schema: ZodType<Output>, value: unknown): Output => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", {
      details: { issues: result.error.issues },
    });
  }
  return result.data;
};

const requireUserId = (request: Request): string => {
  if (!request.auth) throw authenticationRequiredError();
  return request.auth.userId;
};

const approvedSources = new Set([
  "fixture-business-directory",
  "permitted-http-directory",
]);

export const create = async (request: Request, response: Response): Promise<void> => {
  if (
    typeof request.body === "object" &&
    request.body !== null &&
    "source" in request.body &&
    (typeof request.body.source !== "string" ||
      !approvedSources.has(request.body.source))
  ) {
    throw approvedSourceRequiredError();
  }
  const input = parse(createScrapingJobSchema, request.body);
  const result = await createScrapingJob(requireUserId(request), input);
  response.status(202).json({
    success: true,
    message: "Scraping job queued successfully",
    data: { job: result.job },
  });
};

export const createTest = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const input = parse(createTestScrapingJobSchema, request.body);
  const result = await createAndEnqueueTestJob(requireUserId(request), input);
  response.status(202).json({
    success: true,
    message: "Test scraping job queued successfully",
    data: {
      scrapingJobId: result.job.id,
      status: result.job.status,
    },
  });
};

export const list = async (request: Request, response: Response): Promise<void> => {
  const query = parse(listScrapingJobsQuerySchema, request.query);
  const result = await listScrapingJobs(requireUserId(request), query);
  response.status(200).json({
    success: true,
    message: "Scraping jobs fetched successfully",
    data: result,
  });
};

export const detail = async (request: Request, response: Response): Promise<void> => {
  const params = parse(scrapingJobParamsSchema, request.params);
  const job = await getScrapingJob(requireUserId(request), params.jobId);
  response.status(200).json({
    success: true,
    message: "Scraping job fetched successfully",
    data: { job },
  });
};

export const cancel = async (request: Request, response: Response): Promise<void> => {
  const params = parse(scrapingJobParamsSchema, request.params);
  const job = await cancelScrapingJob(requireUserId(request), params.jobId);
  response.status(200).json({
    success: true,
    message: "Scraping job cancelled successfully",
    data: { job },
  });
};

export const retry = async (request: Request, response: Response): Promise<void> => {
  const params = parse(scrapingJobParamsSchema, request.params);
  const result = await retryScrapingJob(requireUserId(request), params.jobId);
  response.status(202).json({
    success: true,
    message: "Scraping job retry queued successfully",
    data: { job: result.job },
  });
};
