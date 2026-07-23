import type {
  ApprovedScrapingSource,
  CreateScrapingJobRequest,
  PaginationMetadata,
  ScrapingJobDetail,
  ScrapingJobStatus,
  ScrapingJobSummary,
} from "@lead-saas/shared-types";

export type {
  ApprovedScrapingSource,
  CreateScrapingJobRequest,
  PaginationMetadata,
  ScrapingJobDetail,
  ScrapingJobStatus,
  ScrapingJobSummary,
};

export const SCRAPING_JOB_STATUSES = [
  "PENDING",
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const satisfies readonly ScrapingJobStatus[];

export const APPROVED_SOURCE_OPTIONS = [
  {
    label: "Fixture business directory",
    value: "fixture-business-directory",
  },
  {
    label: "Approved development directory (server-enabled)",
    value: "permitted-http-directory",
  },
] as const satisfies ReadonlyArray<{
  label: string;
  value: ApprovedScrapingSource;
}>;

export const JOB_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "status",
  "progressPercentage",
  "successCount",
] as const;
export type JobSortField = (typeof JOB_SORT_FIELDS)[number];
export type SortOrder = "asc" | "desc";

export type ScrapingJobListFilters = {
  page: number;
  pageSize: number;
  status?: ScrapingJobStatus;
  source?: ApprovedScrapingSource;
  search?: string;
  sortBy: JobSortField;
  sortOrder: SortOrder;
  createdFrom?: string;
  createdTo?: string;
};

export type ScrapingJobListData = {
  jobs: ScrapingJobSummary[];
  pagination: PaginationMetadata;
};

export const DEFAULT_JOB_FILTERS: ScrapingJobListFilters = {
  page: 1,
  pageSize: 20,
  sortBy: "createdAt",
  sortOrder: "desc",
};

export const isActiveJobStatus = (status: ScrapingJobStatus): boolean =>
  status === "PENDING" || status === "QUEUED" || status === "RUNNING";
