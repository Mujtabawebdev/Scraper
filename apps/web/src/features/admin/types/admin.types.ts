import type {
  AdminAuditLog,
  AdminJobDetail,
  AdminJobSummary,
  AdminSummary,
  AdminUserDetail,
  AdminUserListItem,
  AdminUserRole,
  AdminUserStatus,
  ApprovedSource,
  ApprovedSourceStatus,
  ApprovedSourceType,
  PaginatedAdminAuditLogs,
  PaginatedAdminJobs,
  PaginatedAdminUsers,
  PaginatedApprovedSources,
} from "@lead-saas/shared-types";

export type {
  AdminAuditLog,
  AdminJobDetail,
  AdminJobSummary,
  AdminSummary,
  AdminUserDetail,
  AdminUserListItem,
  AdminUserRole,
  AdminUserStatus,
  ApprovedSource,
  ApprovedSourceStatus,
  ApprovedSourceType,
  PaginatedAdminAuditLogs,
  PaginatedAdminJobs,
  PaginatedAdminUsers,
  PaginatedApprovedSources,
};

export type ListFilters = {
  page: number;
  pageSize: number;
  search?: string | undefined;
};

export type AdminUserFilters = ListFilters & {
  role?: AdminUserRole | undefined;
  status?: AdminUserStatus | undefined;
  sortBy:
    | "createdAt"
    | "updatedAt"
    | "fullName"
    | "email"
    | "role"
    | "status"
    | "lastLoginAt";
  sortOrder: "asc" | "desc";
};

export type AdminJobFilters = ListFilters & {
  userEmail?: string | undefined;
  status?: string | undefined;
  source?: string | undefined;
  createdFrom?: string | undefined;
  createdTo?: string | undefined;
  sortBy: "createdAt" | "updatedAt" | "status" | "progressPercentage";
  sortOrder: "asc" | "desc";
};

export type AdminAuditFilters = ListFilters & {
  action?: string | undefined;
  actorUserId?: string | undefined;
  entityType?: string | undefined;
  entityId?: string | undefined;
  createdFrom?: string | undefined;
  createdTo?: string | undefined;
};

export type AdminSourceFilters = ListFilters & {
  sourceType?: ApprovedSourceType | undefined;
  status?: ApprovedSourceStatus | undefined;
  sortBy: "createdAt" | "updatedAt" | "displayName" | "key" | "status";
  sortOrder: "asc" | "desc";
};

export type CreateAdminSourceInput = {
  key: string;
  displayName: string;
  sourceType: ApprovedSourceType;
  baseUrl?: string | null | undefined;
  requiresApiKey?: boolean | undefined;
  requestsPerMinute?: number | undefined;
  maxConcurrency?: number | undefined;
  reviewNotes?: string | undefined;
};

export type UpdateAdminSourceInput = {
  displayName?: string | undefined;
  sourceType?: ApprovedSourceType | undefined;
  baseUrl?: string | null | undefined;
  requiresApiKey?: boolean | undefined;
  requestsPerMinute?: number | undefined;
  maxConcurrency?: number | undefined;
  reviewNotes?: string | null | undefined;
  status?: ApprovedSourceStatus | undefined;
  isEnabled?: boolean | undefined;
  allowsAutomatedAccess?: boolean | undefined;
  robotsPolicyCheckedAt?: string | null | undefined;
  termsReviewedAt?: string | null | undefined;
  blockedReason?: string | null | undefined;
};
