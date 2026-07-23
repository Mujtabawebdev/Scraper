import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  cancelAdminJob,
  createAdminSource,
  disableAdminSource,
  fetchAdminAuditLogs,
  fetchAdminJob,
  fetchAdminJobs,
  fetchAdminSource,
  fetchAdminSources,
  fetchAdminSummary,
  fetchAdminUser,
  fetchAdminUsers,
  reviewAdminSource,
  updateAdminSource,
  updateAdminUserRole,
  updateAdminUserStatus,
} from "../api/admin.api";
import { adminQueryKeys } from "../api/admin-query-keys";
import type {
  AdminAuditFilters,
  AdminJobFilters,
  AdminSourceFilters,
  AdminUserFilters,
} from "../types/admin.types";

export const useAdminSummary = () =>
  useQuery({
    queryKey: adminQueryKeys.summary(),
    queryFn: fetchAdminSummary,
    staleTime: 30_000,
  });

export const useAdminUsers = (filters: AdminUserFilters) =>
  useQuery({
    queryKey: adminQueryKeys.users.list(filters),
    queryFn: () => fetchAdminUsers(filters),
    placeholderData: keepPreviousData,
  });

export const useAdminUser = (userId: string) =>
  useQuery({
    queryKey: adminQueryKeys.users.detail(userId),
    queryFn: () => fetchAdminUser(userId),
    enabled: Boolean(userId),
  });

export const useAdminJobs = (filters: AdminJobFilters) =>
  useQuery({
    queryKey: adminQueryKeys.jobs.list(filters),
    queryFn: () => fetchAdminJobs(filters),
    placeholderData: keepPreviousData,
    refetchInterval: (query) =>
      query.state.data?.jobs.some((job) =>
        ["PENDING", "QUEUED", "RUNNING"].includes(job.status),
      )
        ? 5_000
        : false,
  });

export const useAdminJob = (jobId: string) =>
  useQuery({
    queryKey: adminQueryKeys.jobs.detail(jobId),
    queryFn: () => fetchAdminJob(jobId),
    enabled: Boolean(jobId),
    refetchInterval: (query) =>
      ["PENDING", "QUEUED", "RUNNING"].includes(
        query.state.data?.status ?? "",
      )
        ? 5_000
        : false,
  });

export const useAdminAuditLogs = (filters: AdminAuditFilters) =>
  useQuery({
    queryKey: adminQueryKeys.auditLogs.list(filters),
    queryFn: () => fetchAdminAuditLogs(filters),
    placeholderData: keepPreviousData,
  });

export const useAdminSources = (filters: AdminSourceFilters) =>
  useQuery({
    queryKey: adminQueryKeys.sources.list(filters),
    queryFn: () => fetchAdminSources(filters),
    placeholderData: keepPreviousData,
  });

export const useAdminSource = (sourceId: string) =>
  useQuery({
    queryKey: adminQueryKeys.sources.detail(sourceId),
    queryFn: () => fetchAdminSource(sourceId),
    enabled: Boolean(sourceId),
  });

export const useAdminMutations = () => {
  const queryClient = useQueryClient();
  const refreshUsers = async () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.users.all() }),
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.summary() }),
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.auditLogs.all() }),
    ]);
  const refreshJobs = async () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.jobs.all() }),
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.summary() }),
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.auditLogs.all() }),
    ]);
  const refreshSources = async () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.sources.all() }),
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.summary() }),
      queryClient.invalidateQueries({ queryKey: adminQueryKeys.auditLogs.all() }),
    ]);

  return {
    updateStatus: useMutation({
      mutationFn: updateAdminUserStatus,
      onSuccess: refreshUsers,
    }),
    updateRole: useMutation({
      mutationFn: updateAdminUserRole,
      onSuccess: refreshUsers,
    }),
    cancelJob: useMutation({
      mutationFn: cancelAdminJob,
      onSuccess: refreshJobs,
    }),
    createSource: useMutation({
      mutationFn: createAdminSource,
      onSuccess: refreshSources,
    }),
    updateSource: useMutation({
      mutationFn: updateAdminSource,
      onSuccess: refreshSources,
    }),
    disableSource: useMutation({
      mutationFn: disableAdminSource,
      onSuccess: refreshSources,
    }),
    reviewSource: useMutation({
      mutationFn: reviewAdminSource,
      onSuccess: refreshSources,
    }),
  };
};
