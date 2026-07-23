import type {
  AdminJobDetail,
  AdminSummary,
  AdminUserDetail,
  AdminUserSummary,
  ApprovedSource,
  PaginatedAdminAuditLogs,
  PaginatedAdminJobs,
  PaginatedAdminUsers,
  PaginatedApprovedSources,
} from "@lead-saas/shared-types";

import { logger } from "../../common/logger/logger.js";
import { removeScrapingQueueJob } from "../../infrastructure/queue/scraping.queue.js";
import {
  adminJobNotFoundError,
  adminUserNotFoundError,
  sourceNotFoundError,
  sourcePolicyRequirementsNotMetError,
  superAdminAccessRequiredError,
} from "./admin.errors.js";
import {
  createAdminPagination,
  mapAdminAuditLog,
  mapAdminJobDetail,
  mapAdminJobSummary,
  mapAdminUserDetail,
  mapAdminUserListItem,
  mapAdminUserSummary,
  mapApprovedSource,
} from "./admin.mapper.js";
import {
  cancelAdminJobTransaction,
  createApprovedSource,
  findAdminJobDetail,
  findApprovedSourceById,
  getAdminSummaryCounts,
  getAdminUserDetailData,
  listAdminAuditLogs,
  listAdminJobs,
  listAdminSources,
  listAdminUsers,
  updateAdminUserRoleTransaction,
  updateAdminUserStatusTransaction,
  updateApprovedSource,
  recordSourceHealthCheck,
} from "./admin.repository.js";
import { env } from "../../config/env.js";
import { isSourceCredentialConfigured } from "../sources/source-configuration.js";
import type {
  AdminActionContext,
  CancelAdminJobInput,
  CreateAdminSourceInput,
  ListAdminAuditLogsQuery,
  ListAdminJobsQuery,
  ListAdminSourcesQuery,
  ListAdminUsersQuery,
  SourceReasonInput,
  UpdateAdminSourceInput,
  UpdateAdminUserRoleInput,
  UpdateAdminUserStatusInput,
} from "./admin.types.js";

const removeQueueJobsSafely = async (
  queueJobIds: readonly string[],
): Promise<void> => {
  await Promise.all(
    queueJobIds.map(async (queueJobId) => {
      try {
        await removeScrapingQueueJob(queueJobId);
      } catch (error: unknown) {
        logger.warn(
          {
            queueJobId,
            errorType: error instanceof Error ? error.name : "UnknownError",
          },
          "Administrator cancellation could not remove a queue job",
        );
      }
    }),
  );
};

export const getAdminSummary = async (): Promise<AdminSummary> =>
  getAdminSummaryCounts();

export const getAdminUsers = async (
  query: ListAdminUsersQuery,
): Promise<PaginatedAdminUsers> => {
  const result = await listAdminUsers(query);
  return {
    users: result.users.map(mapAdminUserListItem),
    pagination: createAdminPagination(
      query.page,
      query.pageSize,
      result.totalItems,
    ),
  };
};

export const getAdminUser = async (
  userId: string,
): Promise<AdminUserDetail> => {
  const result = await getAdminUserDetailData(userId);
  if (!result.user) throw adminUserNotFoundError();
  return mapAdminUserDetail(result.user, result);
};

export const changeAdminUserStatus = async (
  context: AdminActionContext,
  userId: string,
  input: UpdateAdminUserStatusInput,
): Promise<AdminUserSummary> => {
  const result = await updateAdminUserStatusTransaction(context, userId, input);
  await removeQueueJobsSafely(result.queueJobIds);
  return mapAdminUserSummary(result.user);
};

export const changeAdminUserRole = async (
  context: AdminActionContext,
  userId: string,
  input: UpdateAdminUserRoleInput,
): Promise<AdminUserSummary> => {
  if (context.actorRole !== "SUPER_ADMIN") {
    throw superAdminAccessRequiredError();
  }
  const result = await updateAdminUserRoleTransaction(context, userId, input);
  return mapAdminUserSummary(result.user);
};

export const getAdminJobs = async (
  query: ListAdminJobsQuery,
): Promise<PaginatedAdminJobs> => {
  const result = await listAdminJobs(query);
  return {
    jobs: result.jobs.map(mapAdminJobSummary),
    pagination: createAdminPagination(
      query.page,
      query.pageSize,
      result.totalItems,
    ),
  };
};

export const getAdminJob = async (
  jobId: string,
): Promise<AdminJobDetail> => {
  const job = await findAdminJobDetail(jobId);
  if (!job) throw adminJobNotFoundError();
  return mapAdminJobDetail(job);
};

export const cancelAdminJob = async (
  context: AdminActionContext,
  jobId: string,
  input: CancelAdminJobInput,
): Promise<AdminJobDetail> => {
  const result = await cancelAdminJobTransaction(context, jobId, input.reason);
  if (result.queueJobId) await removeQueueJobsSafely([result.queueJobId]);
  return getAdminJob(jobId);
};

export const getAdminAuditLogs = async (
  query: ListAdminAuditLogsQuery,
): Promise<PaginatedAdminAuditLogs> => {
  const result = await listAdminAuditLogs(query);
  return {
    auditLogs: result.auditLogs.map(mapAdminAuditLog),
    pagination: createAdminPagination(
      query.page,
      query.pageSize,
      result.totalItems,
    ),
  };
};

export const getAdminSources = async (
  query: ListAdminSourcesQuery,
): Promise<PaginatedApprovedSources> => {
  const result = await listAdminSources(query);
  return {
    sources: result.sources.map(mapApprovedSource),
    pagination: createAdminPagination(
      query.page,
      query.pageSize,
      result.totalItems,
    ),
  };
};

export const getAdminSource = async (
  sourceId: string,
): Promise<ApprovedSource> => {
  const source = await findApprovedSourceById(sourceId);
  if (!source) throw sourceNotFoundError();
  return mapApprovedSource(source);
};

const requireSuperAdmin = (context: AdminActionContext): void => {
  if (context.actorRole !== "SUPER_ADMIN") {
    throw superAdminAccessRequiredError();
  }
};

const hasConfiguredCredential = (sourceKey: string): boolean => {
  return isSourceCredentialConfigured(sourceKey);
};

type HealthCheckResult = Parameters<typeof recordSourceHealthCheck>[2];

const runGoogleHealthCheck = async (): Promise<HealthCheckResult> => {
  if (!env.GOOGLE_PLACES_API_KEY) {
    return {
      status: "CONFIGURATION_MISSING",
      message: "Google Places API credentials are not configured",
    };
  }
  const startedAt = Date.now();
  try {
    const response = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        signal: AbortSignal.timeout(env.GOOGLE_PLACES_REQUEST_TIMEOUT_MS),
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": env.GOOGLE_PLACES_API_KEY,
          "x-goog-fieldmask": "places.id",
        },
        body: JSON.stringify({
          textQuery: "business in United States",
          pageSize: 1,
          regionCode: env.GOOGLE_PLACES_REGION,
          languageCode: env.GOOGLE_PLACES_LANGUAGE,
        }),
      },
    );
    const latencyMs = Date.now() - startedAt;
    await response.body?.cancel();
    if (response.ok) {
      return {
        status: "HEALTHY",
        message: "Google Places responded successfully",
        latencyMs,
      };
    }
    if (response.status === 429) {
      return {
        status: "QUOTA_LIMITED",
        message: "Google Places quota is currently unavailable",
        latencyMs,
      };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        status: "UNAVAILABLE",
        message: "Google Places credentials are invalid or unauthorized",
        latencyMs,
      };
    }
    return {
      status: "DEGRADED",
      message: "Google Places returned an unsuccessful health response",
      latencyMs,
    };
  } catch {
    return {
      status: "UNAVAILABLE",
      message: "Google Places health check could not reach the provider",
      latencyMs: Date.now() - startedAt,
    };
  }
};

export const healthCheckAdminSource = async (
  context: AdminActionContext,
  sourceId: string,
): Promise<ApprovedSource> => {
  const source = await getAdminSource(sourceId);
  let result: HealthCheckResult;
  if (source.status === "BLOCKED") {
    result = { status: "BLOCKED", message: "Source is blocked by policy" };
  } else if (source.key === "google-places-api") {
    result = await runGoogleHealthCheck();
  } else if (
    source.key === "meta-approved-api" ||
    source.key === "yelp-approved-api" ||
    source.key === "government-dataset"
  ) {
    result = {
      status: "CONFIGURATION_MISSING",
      message: "No reviewed provider adapter is enabled",
    };
  } else {
    result = {
      status: "HEALTHY",
      message: "Local source policy configuration is valid",
      latencyMs: 0,
    };
  }
  return mapApprovedSource(
    await recordSourceHealthCheck(context, sourceId, result),
  );
};

const validateSourceBaseUrl = (baseUrl: string | null | undefined): void => {
  if (!baseUrl) return;
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw sourcePolicyRequirementsNotMetError();
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password
  ) {
    throw sourcePolicyRequirementsNotMetError();
  }
};

const requiresRobotsReview = (sourceType: ApprovedSource["sourceType"]): boolean =>
  sourceType === "PUBLIC_DIRECTORY" || sourceType === "OFFICIAL_WEBSITE";

const assertApprovalRequirements = (
  source: ApprovedSource,
): void => {
  validateSourceBaseUrl(source.baseUrl);
  if (!source.termsReviewedAt) throw sourcePolicyRequirementsNotMetError();
  if (requiresRobotsReview(source.sourceType) && !source.robotsPolicyCheckedAt) {
    throw sourcePolicyRequirementsNotMetError();
  }
  if (source.requiresApiKey && !hasConfiguredCredential(source.key)) {
    throw sourcePolicyRequirementsNotMetError();
  }
  if (!source.allowsAutomatedAccess) {
    throw sourcePolicyRequirementsNotMetError();
  }
};

export const createAdminSource = async (
  context: AdminActionContext,
  input: CreateAdminSourceInput,
): Promise<ApprovedSource> => {
  requireSuperAdmin(context);
  validateSourceBaseUrl(input.baseUrl);
  return mapApprovedSource(await createApprovedSource(context, input));
};

export const changeAdminSource = async (
  context: AdminActionContext,
  sourceId: string,
  input: UpdateAdminSourceInput,
): Promise<ApprovedSource> => {
  requireSuperAdmin(context);
  const existing = await getAdminSource(sourceId);
  const candidate: ApprovedSource = {
    ...existing,
    displayName: input.displayName ?? existing.displayName,
    sourceType: input.sourceType ?? existing.sourceType,
    baseUrl: input.baseUrl === undefined ? existing.baseUrl : input.baseUrl,
    status: input.status ?? existing.status,
    isEnabled: input.isEnabled ?? existing.isEnabled,
    requiresApiKey: input.requiresApiKey ?? existing.requiresApiKey,
    allowsAutomatedAccess:
      input.allowsAutomatedAccess ?? existing.allowsAutomatedAccess,
    requestsPerMinute:
      input.requestsPerMinute ?? existing.requestsPerMinute,
    maxConcurrency: input.maxConcurrency ?? existing.maxConcurrency,
    reviewNotes:
      input.reviewNotes === undefined ? existing.reviewNotes : input.reviewNotes,
    blockedReason:
      input.blockedReason === undefined
        ? existing.blockedReason
        : input.blockedReason,
    robotsPolicyCheckedAt:
      input.robotsPolicyCheckedAt === undefined
        ? existing.robotsPolicyCheckedAt
        : input.robotsPolicyCheckedAt?.toISOString() ?? null,
    termsReviewedAt:
      input.termsReviewedAt === undefined
        ? existing.termsReviewedAt
        : input.termsReviewedAt?.toISOString() ?? null,
  };
  validateSourceBaseUrl(candidate.baseUrl);
  if (candidate.status === "BLOCKED") {
    if (!candidate.blockedReason) throw sourcePolicyRequirementsNotMetError();
    candidate.isEnabled = false;
    candidate.allowsAutomatedAccess = false;
  }
  if (
    candidate.status === "DISABLED" ||
    candidate.status === "REVIEW_REQUIRED"
  ) {
    candidate.isEnabled = false;
  }
  if (candidate.status === "APPROVED" || candidate.isEnabled) {
    assertApprovalRequirements(candidate);
  }
  if (candidate.isEnabled && candidate.status !== "APPROVED") {
    throw sourcePolicyRequirementsNotMetError();
  }

  const normalizedInput: UpdateAdminSourceInput = {
    ...input,
    status: candidate.status,
    isEnabled: candidate.isEnabled,
    allowsAutomatedAccess: candidate.allowsAutomatedAccess,
    blockedReason: candidate.blockedReason,
  };
  return mapApprovedSource(
    await updateApprovedSource(
      context,
      sourceId,
      normalizedInput,
      `Source ${candidate.key} policy settings updated`,
    ),
  );
};

export const disableAdminSource = async (
  context: AdminActionContext,
  sourceId: string,
  input: SourceReasonInput,
): Promise<ApprovedSource> => {
  requireSuperAdmin(context);
  return mapApprovedSource(
    await updateApprovedSource(
      context,
      sourceId,
      {
        status: "DISABLED",
        isEnabled: false,
        allowsAutomatedAccess: false,
        reviewNotes: input.reason,
        blockedReason: null,
      },
      `Source disabled: ${input.reason}`,
    ),
  );
};

export const markAdminSourceReviewRequired = async (
  context: AdminActionContext,
  sourceId: string,
  input: SourceReasonInput,
): Promise<ApprovedSource> => {
  requireSuperAdmin(context);
  return mapApprovedSource(
    await updateApprovedSource(
      context,
      sourceId,
      {
        status: "REVIEW_REQUIRED",
        isEnabled: false,
        allowsAutomatedAccess: false,
        reviewNotes: input.reason,
        blockedReason: null,
      },
      `Source marked for review: ${input.reason}`,
    ),
  );
};
