import type {
  AdminAuditFilters,
  AdminJobFilters,
  AdminSourceFilters,
  AdminUserFilters,
} from "../types/admin.types";

export const adminQueryKeys = {
  all: ["admin"] as const,
  summary: () => ["admin", "summary"] as const,
  users: {
    all: () => ["admin", "users"] as const,
    list: (filters: AdminUserFilters) =>
      ["admin", "users", "list", filters] as const,
    detail: (userId: string) => ["admin", "users", "detail", userId] as const,
  },
  jobs: {
    all: () => ["admin", "jobs"] as const,
    list: (filters: AdminJobFilters) =>
      ["admin", "jobs", "list", filters] as const,
    detail: (jobId: string) => ["admin", "jobs", "detail", jobId] as const,
  },
  auditLogs: {
    all: () => ["admin", "audit-logs"] as const,
    list: (filters: AdminAuditFilters) =>
      ["admin", "audit-logs", "list", filters] as const,
  },
  sources: {
    all: () => ["admin", "sources"] as const,
    list: (filters: AdminSourceFilters) =>
      ["admin", "sources", "list", filters] as const,
    detail: (sourceId: string) =>
      ["admin", "sources", "detail", sourceId] as const,
  },
};
