import type {
  PaginationMetadata,
  ScrapingJobStatus,
} from "./job-lead.types.js";

export const adminUserRoles = ["USER", "ADMIN", "SUPER_ADMIN"] as const;
export type AdminUserRole = (typeof adminUserRoles)[number];

export const adminUserStatuses = ["ACTIVE", "SUSPENDED", "DISABLED"] as const;
export type AdminUserStatus = (typeof adminUserStatuses)[number];

export const approvedSourceTypes = [
  "FIXTURE",
  "OFFICIAL_API",
  "PUBLIC_DIRECTORY",
  "GOVERNMENT_DATASET",
  "OFFICIAL_WEBSITE",
  "LICENSED_DATASET",
  "CSV_IMPORT",
] as const;
export type ApprovedSourceType = (typeof approvedSourceTypes)[number];

export const approvedSourceStatuses = [
  "APPROVED",
  "DISABLED",
  "BLOCKED",
  "REVIEW_REQUIRED",
] as const;
export type ApprovedSourceStatus = (typeof approvedSourceStatuses)[number];

export type AdminSummary = {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  disabledUsers: number;
  usersCreatedToday: number;
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  jobsCreatedToday: number;
  totalLeads: number;
  leadsCreatedToday: number;
  leadsWithPhone: number;
  leadsWithEmail: number;
  approvedSources: number;
  disabledSources: number;
  blockedSources: number;
  reviewRequiredSources: number;
};

export type AdminUserSummary = {
  id: string;
  fullName: string;
  email: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminUserListItem = AdminUserSummary & {
  totalJobs: number;
  totalLeads: number;
};

export type SafeAuditEvent = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string | null;
  createdAt: string;
};

export type AdminUserDetail = AdminUserSummary & {
  activeSessionCount: number;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  totalLeads: number;
  recentAuditEvents: SafeAuditEvent[];
};

export type AdminOwnerSummary = {
  id: string;
  fullName: string;
  email: string;
};

export type AdminJobSummary = {
  id: string;
  owner: AdminOwnerSummary;
  source: string;
  status: ScrapingJobStatus;
  searchQuery: string;
  location: string;
  requestedLimit: number;
  processedCount: number;
  successCount: number;
  failureCount: number;
  duplicateCount: number;
  progressPercentage: number;
  leadCount: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  cancelledAt: string | null;
};

export type AdminJobRetrySummary = {
  id: string;
  status: ScrapingJobStatus;
  createdAt: string;
};

export type AdminJobDetail = AdminJobSummary & {
  updatedAt: string;
  errorMessage: string | null;
  canCancel: boolean;
  retryOfJobId: string | null;
  retries: AdminJobRetrySummary[];
};

export type AdminAuditLog = {
  id: string;
  action: string;
  actor: AdminOwnerSummary | null;
  targetUser: AdminOwnerSummary | null;
  entityType: string;
  entityId: string | null;
  metadata: Readonly<Record<string, unknown>> | null;
  summary: string | null;
  createdAt: string;
};

export type ApprovedSource = {
  id: string;
  key: string;
  displayName: string;
  sourceType: ApprovedSourceType;
  baseUrl: string | null;
  status: ApprovedSourceStatus;
  isEnabled: boolean;
  requiresApiKey: boolean;
  allowsAutomatedAccess: boolean;
  requestsPerMinute: number;
  maxConcurrency: number;
  robotsPolicyCheckedAt: string | null;
  termsReviewedAt: string | null;
  reviewNotes: string | null;
  blockedReason: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: AdminOwnerSummary | null;
  updatedBy: AdminOwnerSummary | null;
};

export type PaginatedAdminUsers = {
  users: AdminUserListItem[];
  pagination: PaginationMetadata;
};

export type PaginatedAdminJobs = {
  jobs: AdminJobSummary[];
  pagination: PaginationMetadata;
};

export type PaginatedAdminAuditLogs = {
  auditLogs: AdminAuditLog[];
  pagination: PaginationMetadata;
};

export type PaginatedApprovedSources = {
  sources: ApprovedSource[];
  pagination: PaginationMetadata;
};
