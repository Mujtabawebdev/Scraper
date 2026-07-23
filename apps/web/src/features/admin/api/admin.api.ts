import { apiClient } from "../../../services/api-client";
import type {
  AdminAuditFilters,
  AdminJobDetail,
  AdminJobFilters,
  AdminSourceFilters,
  AdminSummary,
  AdminUserDetail,
  AdminUserFilters,
  AdminUserRole,
  AdminUserStatus,
  ApprovedSource,
  CreateAdminSourceInput,
  PaginatedAdminAuditLogs,
  PaginatedAdminJobs,
  PaginatedAdminUsers,
  PaginatedApprovedSources,
  UpdateAdminSourceInput,
} from "../types/admin.types";

type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
};

const toParams = (
  filters: Readonly<Record<string, string | number | boolean | undefined>>,
): URLSearchParams => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return params;
};

export const fetchAdminSummary = async (): Promise<AdminSummary> => {
  const response =
    await apiClient.get<ApiSuccess<{ summary: AdminSummary }>>("/admin/summary");
  return response.data.data.summary;
};

export const fetchAdminUsers = async (
  filters: AdminUserFilters,
): Promise<PaginatedAdminUsers> => {
  const response = await apiClient.get<ApiSuccess<PaginatedAdminUsers>>(
    "/admin/users",
    { params: toParams(filters) },
  );
  return response.data.data;
};

export const fetchAdminUser = async (
  userId: string,
): Promise<AdminUserDetail> => {
  const response = await apiClient.get<ApiSuccess<{ user: AdminUserDetail }>>(
    `/admin/users/${encodeURIComponent(userId)}`,
  );
  return response.data.data.user;
};

export const updateAdminUserStatus = async (input: {
  userId: string;
  status: AdminUserStatus;
  reason: string;
}): Promise<AdminUserDetail> => {
  const response = await apiClient.patch<ApiSuccess<{ user: AdminUserDetail }>>(
    `/admin/users/${encodeURIComponent(input.userId)}/status`,
    { status: input.status, reason: input.reason },
  );
  return response.data.data.user;
};

export const updateAdminUserRole = async (input: {
  userId: string;
  role: AdminUserRole;
  reason: string;
}): Promise<AdminUserDetail> => {
  const response = await apiClient.patch<ApiSuccess<{ user: AdminUserDetail }>>(
    `/admin/users/${encodeURIComponent(input.userId)}/role`,
    { role: input.role, reason: input.reason },
  );
  return response.data.data.user;
};

export const fetchAdminJobs = async (
  filters: AdminJobFilters,
): Promise<PaginatedAdminJobs> => {
  const response = await apiClient.get<ApiSuccess<PaginatedAdminJobs>>(
    "/admin/scraping-jobs",
    { params: toParams(filters) },
  );
  return response.data.data;
};

export const fetchAdminJob = async (
  jobId: string,
): Promise<AdminJobDetail> => {
  const response = await apiClient.get<ApiSuccess<{ job: AdminJobDetail }>>(
    `/admin/scraping-jobs/${encodeURIComponent(jobId)}`,
  );
  return response.data.data.job;
};

export const cancelAdminJob = async (input: {
  jobId: string;
  reason: string;
}): Promise<AdminJobDetail> => {
  const response = await apiClient.post<ApiSuccess<{ job: AdminJobDetail }>>(
    `/admin/scraping-jobs/${encodeURIComponent(input.jobId)}/cancel`,
    { reason: input.reason },
  );
  return response.data.data.job;
};

export const fetchAdminAuditLogs = async (
  filters: AdminAuditFilters,
): Promise<PaginatedAdminAuditLogs> => {
  const response = await apiClient.get<ApiSuccess<PaginatedAdminAuditLogs>>(
    "/admin/audit-logs",
    { params: toParams(filters) },
  );
  return response.data.data;
};

export const fetchAdminSources = async (
  filters: AdminSourceFilters,
): Promise<PaginatedApprovedSources> => {
  const response = await apiClient.get<ApiSuccess<PaginatedApprovedSources>>(
    "/admin/sources",
    { params: toParams(filters) },
  );
  return response.data.data;
};

export const fetchAdminSource = async (
  sourceId: string,
): Promise<ApprovedSource> => {
  const response = await apiClient.get<ApiSuccess<{ source: ApprovedSource }>>(
    `/admin/sources/${encodeURIComponent(sourceId)}`,
  );
  return response.data.data.source;
};

export const createAdminSource = async (
  input: CreateAdminSourceInput,
): Promise<ApprovedSource> => {
  const response = await apiClient.post<ApiSuccess<{ source: ApprovedSource }>>(
    "/admin/sources",
    input,
  );
  return response.data.data.source;
};

export const updateAdminSource = async (input: {
  sourceId: string;
  changes: UpdateAdminSourceInput;
}): Promise<ApprovedSource> => {
  const response = await apiClient.patch<ApiSuccess<{ source: ApprovedSource }>>(
    `/admin/sources/${encodeURIComponent(input.sourceId)}`,
    input.changes,
  );
  return response.data.data.source;
};

export const disableAdminSource = async (input: {
  sourceId: string;
  reason: string;
}): Promise<ApprovedSource> => {
  const response = await apiClient.post<ApiSuccess<{ source: ApprovedSource }>>(
    `/admin/sources/${encodeURIComponent(input.sourceId)}/disable`,
    { reason: input.reason },
  );
  return response.data.data.source;
};

export const reviewAdminSource = async (input: {
  sourceId: string;
  reason: string;
}): Promise<ApprovedSource> => {
  const response = await apiClient.post<ApiSuccess<{ source: ApprovedSource }>>(
    `/admin/sources/${encodeURIComponent(input.sourceId)}/mark-review-required`,
    { reason: input.reason },
  );
  return response.data.data.source;
};
