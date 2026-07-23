import type {
  ApprovedScrapingSource,
  JobSortField,
  ScrapingJobListFilters,
  ScrapingJobStatus,
  SortOrder,
} from "../types/scraping-job.types";
import { z } from "zod";
import {
  APPROVED_SOURCE_OPTIONS,
  DEFAULT_JOB_FILTERS,
  JOB_SORT_FIELDS,
  SCRAPING_JOB_STATUSES,
} from "../types/scraping-job.types";

const readBoundedInteger = (
  value: string | null,
  fallback: number,
  maximum: number,
): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= maximum
    ? parsed
    : fallback;
};

const isJobStatus = (value: string): value is ScrapingJobStatus =>
  SCRAPING_JOB_STATUSES.some((status) => status === value);

const isJobSortField = (value: string): value is JobSortField =>
  JOB_SORT_FIELDS.some((field) => field === value);

const isSortOrder = (value: string): value is SortOrder =>
  value === "asc" || value === "desc";

const isApprovedSource = (value: string): value is ApprovedScrapingSource =>
  APPROVED_SOURCE_OPTIONS.some((source) => source.value === value);

const dateFilterSchema = z.iso.date();

const readDateFilter = (value: string | null): string | undefined => {
  const result = dateFilterSchema.safeParse(value);
  return result.success ? result.data : undefined;
};

const readOptionalText = (
  value: string | null,
  maximumLength: number,
): string | undefined => {
  const normalized = value?.trim();
  return normalized && normalized.length <= maximumLength
    ? normalized
    : undefined;
};

export const parseJobFilters = (
  searchParams: URLSearchParams,
): ScrapingJobListFilters => {
  const statusValue = searchParams.get("status") ?? "";
  const sourceValue = searchParams.get("source") ?? "";
  const sortByValue = searchParams.get("sortBy") ?? "";
  const sortOrderValue = searchParams.get("sortOrder") ?? "";
  const status = isJobStatus(statusValue) ? statusValue : undefined;
  const source = isApprovedSource(sourceValue) ? sourceValue : undefined;
  const search = readOptionalText(searchParams.get("search"), 100);
  const parsedCreatedFrom = readDateFilter(searchParams.get("createdFrom"));
  const parsedCreatedTo = readDateFilter(searchParams.get("createdTo"));
  const validDateRange =
    !parsedCreatedFrom ||
    !parsedCreatedTo ||
    parsedCreatedFrom <= parsedCreatedTo;
  const createdFrom = validDateRange ? parsedCreatedFrom : undefined;
  const createdTo = validDateRange ? parsedCreatedTo : undefined;

  return {
    page: readBoundedInteger(searchParams.get("page"), 1, 1_000_000),
    pageSize: readBoundedInteger(searchParams.get("pageSize"), 20, 100),
    sortBy: isJobSortField(sortByValue) ? sortByValue : "createdAt",
    sortOrder: isSortOrder(sortOrderValue) ? sortOrderValue : "desc",
    ...(status ? { status } : {}),
    ...(source ? { source } : {}),
    ...(search ? { search } : {}),
    ...(createdFrom ? { createdFrom } : {}),
    ...(createdTo ? { createdTo } : {}),
  };
};

export const serializeJobFilters = (
  filters: ScrapingJobListFilters,
): URLSearchParams => {
  const params = new URLSearchParams();
  if (filters.page !== DEFAULT_JOB_FILTERS.page) {
    params.set("page", String(filters.page));
  }
  if (filters.pageSize !== DEFAULT_JOB_FILTERS.pageSize) {
    params.set("pageSize", String(filters.pageSize));
  }
  if (filters.status) {
    params.set("status", filters.status);
  }
  if (filters.source) {
    params.set("source", filters.source);
  }
  if (filters.search) {
    params.set("search", filters.search);
  }
  if (filters.sortBy !== DEFAULT_JOB_FILTERS.sortBy) {
    params.set("sortBy", filters.sortBy);
  }
  if (filters.sortOrder !== DEFAULT_JOB_FILTERS.sortOrder) {
    params.set("sortOrder", filters.sortOrder);
  }
  if (filters.createdFrom) {
    params.set("createdFrom", filters.createdFrom);
  }
  if (filters.createdTo) {
    params.set("createdTo", filters.createdTo);
  }
  return params;
};
