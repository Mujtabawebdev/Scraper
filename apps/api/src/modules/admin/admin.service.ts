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
} from "./admin.repository.js";
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
  const variableName = `SOURCE_${sourceKey
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")}_API_KEY`;
  return Boolean(process.env[variableName]?.trim());
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
