import type {
  AdminAuditLog,
  AdminJobDetail,
  AdminJobSummary,
  AdminUserDetail,
  AdminUserListItem,
  AdminUserSummary,
  ApprovedSource,
  PaginationMetadata,
  SafeAuditEvent,
  ScrapingJobStatus,
} from "@lead-saas/shared-types";

import type {
  AdminAuditLogRecord,
  AdminJobDetailRecord,
  AdminJobSummaryRecord,
  AdminUserListRecord,
  AdminUserSummaryRecord,
  ApprovedSourceRecord,
} from "./admin.repository.js";
import { isSourceCredentialConfigured } from "../sources/source-configuration.js";

const toIsoString = (value: Date | null): string | null =>
  value?.toISOString() ?? null;

const toPublicJobStatus = (
  status: AdminJobSummaryRecord["status"],
): ScrapingJobStatus => (status === "PAUSED" ? "CANCELLED" : status);

export const createAdminPagination = (
  page: number,
  pageSize: number,
  totalItems: number,
): PaginationMetadata => {
  const totalPages = Math.ceil(totalItems / pageSize);
  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1 && totalPages > 0,
  };
};

export const mapAdminUserSummary = (
  user: AdminUserSummaryRecord,
): AdminUserSummary => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  role: user.role,
  status: user.status,
  lastLoginAt: toIsoString(user.lastLoginAt),
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
});

export const mapAdminUserListItem = (
  user: AdminUserListRecord,
): AdminUserListItem => ({
  ...mapAdminUserSummary(user),
  totalJobs: user._count.scrapingJobs,
  totalLeads: user._count.leads,
});

const sensitiveKeyPattern =
  /(password|token|cookie|authorization|secret|api.?key|credential|refresh|hash)/i;

const sanitizeAuditValue = (
  value: unknown,
  depth = 0,
): unknown => {
  if (depth > 4) return "[TRUNCATED]";
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return value;
  }
  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => sanitizeAuditValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value).slice(0, 50)) {
      result[key] = sensitiveKeyPattern.test(key)
        ? "[REDACTED]"
        : sanitizeAuditValue(item, depth + 1);
    }
    return result;
  }
  return String(value);
};

const safeAuditMetadata = (
  metadata: unknown,
): Readonly<Record<string, unknown>> | null => {
  const value = sanitizeAuditValue(metadata);
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;
};

const auditSummary = (metadata: unknown): string | null => {
  const safe = safeAuditMetadata(metadata);
  return typeof safe?.summary === "string" ? safe.summary : null;
};

export const mapSafeAuditEvent = (
  auditLog: AdminAuditLogRecord,
): SafeAuditEvent => ({
  id: auditLog.id,
  action: auditLog.action,
  entityType: auditLog.entityType,
  entityId: auditLog.entityId,
  summary: auditSummary(auditLog.metadata),
  createdAt: auditLog.createdAt.toISOString(),
});

export const mapAdminUserDetail = (
  user: AdminUserSummaryRecord,
  aggregate: {
    activeSessionCount: number;
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    totalLeads: number;
    recentAuditEvents: AdminAuditLogRecord[];
  },
): AdminUserDetail => ({
  ...mapAdminUserSummary(user),
  activeSessionCount: aggregate.activeSessionCount,
  totalJobs: aggregate.totalJobs,
  completedJobs: aggregate.completedJobs,
  failedJobs: aggregate.failedJobs,
  totalLeads: aggregate.totalLeads,
  recentAuditEvents: aggregate.recentAuditEvents.map(mapSafeAuditEvent),
});

export const mapAdminJobSummary = (
  job: AdminJobSummaryRecord,
): AdminJobSummary => ({
  id: job.id,
  owner: job.user,
  source: job.source,
  status: toPublicJobStatus(job.status),
  searchQuery: job.searchQuery ?? job.name,
  location: job.location,
  requestedLimit: job.requestedLimit,
  processedCount: job.processedCount,
  successCount: job.successCount,
  failureCount: job.failureCount,
  duplicateCount: job.duplicateCount,
  progressPercentage: Math.min(100, Math.max(0, job.progressPercentage)),
  leadCount: job._count.leads,
  createdAt: job.createdAt.toISOString(),
  startedAt: toIsoString(job.startedAt),
  completedAt: toIsoString(job.completedAt),
  failedAt: toIsoString(job.failedAt),
  cancelledAt: toIsoString(job.cancelledAt),
});

export const mapAdminJobDetail = (
  job: AdminJobDetailRecord,
): AdminJobDetail => ({
  ...mapAdminJobSummary(job),
  updatedAt: job.updatedAt.toISOString(),
  errorMessage: job.errorMessage,
  canCancel:
    job.status === "PENDING" ||
    job.status === "QUEUED" ||
    job.status === "RUNNING",
  retryOfJobId: job.retryOfJobId,
  retries: job.retries.map((retry) => ({
    id: retry.id,
    status: toPublicJobStatus(retry.status),
    createdAt: retry.createdAt.toISOString(),
  })),
});

export const mapAdminAuditLog = (
  auditLog: AdminAuditLogRecord,
): AdminAuditLog => ({
  id: auditLog.id,
  action: auditLog.action,
  actor: auditLog.actor,
  targetUser: auditLog.targetUser,
  entityType: auditLog.entityType,
  entityId: auditLog.entityId,
  metadata: safeAuditMetadata(auditLog.metadata),
  summary: auditSummary(auditLog.metadata),
  createdAt: auditLog.createdAt.toISOString(),
});

export const mapApprovedSource = (
  source: ApprovedSourceRecord,
): ApprovedSource => ({
  id: source.id,
  key: source.key,
  displayName: source.displayName,
  sourceType: source.sourceType,
  baseUrl: source.baseUrl,
  status: source.status,
  isEnabled: source.isEnabled,
  requiresApiKey: source.requiresApiKey,
  allowsAutomatedAccess: source.allowsAutomatedAccess,
  requestsPerMinute: source.requestsPerMinute,
  maxConcurrency: source.maxConcurrency,
  robotsPolicyCheckedAt: toIsoString(source.robotsPolicyCheckedAt),
  termsReviewedAt: toIsoString(source.termsReviewedAt),
  reviewNotes: source.reviewNotes,
  blockedReason: source.blockedReason,
  lastHealthCheckAt: toIsoString(source.lastHealthCheckAt),
  lastHealthCheckStatus: source.lastHealthCheckStatus,
  lastHealthCheckMessage: source.lastHealthCheckMessage,
  lastHealthCheckLatencyMs: source.lastHealthCheckLatencyMs,
  lastSuccessfulRequestAt: toIsoString(source.lastSuccessfulRequestAt),
  recentFailureCount: source.recentFailureCount,
  quotaLimitedUntil: toIsoString(source.quotaLimitedUntil),
  credentialConfigured:
    !source.requiresApiKey || isSourceCredentialConfigured(source.key),
  createdAt: source.createdAt.toISOString(),
  updatedAt: source.updatedAt.toISOString(),
  createdBy: source.createdBy,
  updatedBy: source.updatedBy,
});
