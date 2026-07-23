import type { Request, Response } from "express";
import type { ZodType } from "zod";

import { AppError } from "../../common/errors/app-error.js";
import { authenticationRequiredError } from "../auth/auth.errors.js";
import {
  adminJobParamsSchema,
  adminSourceParamsSchema,
  adminUserParamsSchema,
  cancelAdminJobSchema,
  createAdminSourceSchema,
  listAdminAuditLogsQuerySchema,
  listAdminJobsQuerySchema,
  listAdminSourcesQuerySchema,
  listAdminUsersQuerySchema,
  sourceReasonSchema,
  updateAdminSourceSchema,
  updateAdminUserRoleSchema,
  updateAdminUserStatusSchema,
} from "./admin.schemas.js";
import {
  cancelAdminJob,
  changeAdminSource,
  changeAdminUserRole,
  changeAdminUserStatus,
  createAdminSource,
  disableAdminSource,
  getAdminAuditLogs,
  getAdminJob,
  getAdminJobs,
  getAdminSource,
  getAdminSources,
  healthCheckAdminSource,
  getAdminSummary,
  getAdminUser,
  getAdminUsers,
  markAdminSourceReviewRequired,
} from "./admin.service.js";
import type { AdminActionContext } from "./admin.types.js";

const parse = <Output>(schema: ZodType<Output>, value: unknown): Output => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", {
      details: { issues: result.error.issues },
    });
  }
  return result.data;
};

const requireAdminContext = (request: Request): AdminActionContext => {
  if (!request.auth) throw authenticationRequiredError();
  const userAgent = request.get("user-agent");
  return {
    actorUserId: request.auth.userId,
    actorRole: request.auth.role,
    ...(request.ip ? { ipAddress: request.ip } : {}),
    ...(userAgent ? { userAgent: userAgent.slice(0, 500) } : {}),
  };
};

export const summary = async (
  _request: Request,
  response: Response,
): Promise<void> => {
  response.status(200).json({
    success: true,
    message: "Admin summary fetched successfully",
    data: { summary: await getAdminSummary() },
  });
};

export const users = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = parse(listAdminUsersQuerySchema, request.query);
  response.status(200).json({
    success: true,
    message: "Users fetched successfully",
    data: await getAdminUsers(query),
  });
};

export const userDetail = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = parse(adminUserParamsSchema, request.params);
  response.status(200).json({
    success: true,
    message: "User fetched successfully",
    data: { user: await getAdminUser(params.userId) },
  });
};

export const updateUserStatus = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = parse(adminUserParamsSchema, request.params);
  const input = parse(updateAdminUserStatusSchema, request.body);
  response.status(200).json({
    success: true,
    message: "User status updated successfully",
    data: {
      user: await changeAdminUserStatus(
        requireAdminContext(request),
        params.userId,
        input,
      ),
    },
  });
};

export const updateUserRole = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = parse(adminUserParamsSchema, request.params);
  const input = parse(updateAdminUserRoleSchema, request.body);
  response.status(200).json({
    success: true,
    message: "User role updated successfully",
    data: {
      user: await changeAdminUserRole(
        requireAdminContext(request),
        params.userId,
        input,
      ),
    },
  });
};

export const jobs = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = parse(listAdminJobsQuerySchema, request.query);
  response.status(200).json({
    success: true,
    message: "Admin scraping jobs fetched successfully",
    data: await getAdminJobs(query),
  });
};

export const jobDetail = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = parse(adminJobParamsSchema, request.params);
  response.status(200).json({
    success: true,
    message: "Admin scraping job fetched successfully",
    data: { job: await getAdminJob(params.jobId) },
  });
};

export const cancelJob = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = parse(adminJobParamsSchema, request.params);
  const input = parse(cancelAdminJobSchema, request.body);
  response.status(200).json({
    success: true,
    message: "Scraping job cancelled successfully",
    data: {
      job: await cancelAdminJob(
        requireAdminContext(request),
        params.jobId,
        input,
      ),
    },
  });
};

export const auditLogs = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = parse(listAdminAuditLogsQuerySchema, request.query);
  response.status(200).json({
    success: true,
    message: "Audit logs fetched successfully",
    data: await getAdminAuditLogs(query),
  });
};

export const sources = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const query = parse(listAdminSourcesQuerySchema, request.query);
  response.status(200).json({
    success: true,
    message: "Approved sources fetched successfully",
    data: await getAdminSources(query),
  });
};

export const sourceDetail = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = parse(adminSourceParamsSchema, request.params);
  response.status(200).json({
    success: true,
    message: "Approved source fetched successfully",
    data: { source: await getAdminSource(params.sourceId) },
  });
};

export const createSource = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const input = parse(createAdminSourceSchema, request.body);
  response.status(201).json({
    success: true,
    message: "Source created for review successfully",
    data: {
      source: await createAdminSource(requireAdminContext(request), input),
    },
  });
};

export const updateSource = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = parse(adminSourceParamsSchema, request.params);
  const input = parse(updateAdminSourceSchema, request.body);
  response.status(200).json({
    success: true,
    message: "Source updated successfully",
    data: {
      source: await changeAdminSource(
        requireAdminContext(request),
        params.sourceId,
        input,
      ),
    },
  });
};

export const disableSource = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = parse(adminSourceParamsSchema, request.params);
  const input = parse(sourceReasonSchema, request.body);
  response.status(200).json({
    success: true,
    message: "Source disabled successfully",
    data: {
      source: await disableAdminSource(
        requireAdminContext(request),
        params.sourceId,
        input,
      ),
    },
  });
};

export const markSourceReviewRequired = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = parse(adminSourceParamsSchema, request.params);
  const input = parse(sourceReasonSchema, request.body);
  response.status(200).json({
    success: true,
    message: "Source marked for review successfully",
    data: {
      source: await markAdminSourceReviewRequired(
        requireAdminContext(request),
        params.sourceId,
        input,
      ),
    },
  });
};

export const healthCheckSource = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const params = parse(adminSourceParamsSchema, request.params);
  response.status(200).json({
    success: true,
    message: "Source health check completed",
    data: {
      source: await healthCheckAdminSource(
        requireAdminContext(request),
        params.sourceId,
      ),
    },
  });
};
