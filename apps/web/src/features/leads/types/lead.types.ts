import type {
  LeadDetail,
  LeadProvenance,
  LeadSummary,
  PaginationMetadata,
} from "@lead-saas/shared-types";

export type { LeadDetail, LeadProvenance, LeadSummary, PaginationMetadata };

export const LEAD_SORT_FIELDS = [
  "createdAt",
  "businessName",
  "city",
  "state",
  "source",
  "confidenceScore",
  "lastVerifiedAt",
] as const;
export type LeadSortField = (typeof LEAD_SORT_FIELDS)[number];
export type SortOrder = "asc" | "desc";

export type LeadListFilters = {
  page: number;
  pageSize: number;
  search?: string;
  jobId?: string;
  source?: string;
  category?: string;
  city?: string;
  state?: string;
  hasPhone?: boolean;
  hasValidPhone?: boolean;
  phoneValidationStatus?: LeadSummary["phoneValidationStatus"];
  confidenceLevel?: LeadSummary["confidenceLevel"];
  sourceType?: string;
  hasEmail?: boolean;
  hasWebsite?: boolean;
  sortBy: LeadSortField;
  sortOrder: SortOrder;
  createdFrom?: string;
  createdTo?: string;
  lastVerifiedFrom?: string;
  lastVerifiedTo?: string;
};

export type LeadListData = {
  leads: LeadSummary[];
  pagination: PaginationMetadata;
};

export const DEFAULT_LEAD_FILTERS: LeadListFilters = {
  page: 1,
  pageSize: 25,
  sortBy: "createdAt",
  sortOrder: "desc",
};
