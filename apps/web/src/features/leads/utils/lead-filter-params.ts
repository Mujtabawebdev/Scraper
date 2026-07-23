import {
  DEFAULT_LEAD_FILTERS,
  LEAD_SORT_FIELDS,
  type LeadListFilters,
  type LeadSortField,
  type SortOrder,
} from "../types/lead.types";
import { z } from "zod";

const uuidFilterSchema = z.uuid();
const dateFilterSchema = z.iso.date();

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

const readOptionalText = (
  value: string | null,
  maximumLength: number,
): string | undefined => {
  const normalized = value?.trim();
  return normalized && normalized.length <= maximumLength
    ? normalized
    : undefined;
};

const readOptionalBoolean = (value: string | null): boolean | undefined => {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};

const readUuidFilter = (value: string | null): string | undefined => {
  const result = uuidFilterSchema.safeParse(value);
  return result.success ? result.data : undefined;
};

const readDateFilter = (value: string | null): string | undefined => {
  const result = dateFilterSchema.safeParse(value);
  return result.success ? result.data : undefined;
};

const isLeadSortField = (value: string): value is LeadSortField =>
  LEAD_SORT_FIELDS.some((field) => field === value);

const isSortOrder = (value: string): value is SortOrder =>
  value === "asc" || value === "desc";

export const parseLeadFilters = (
  searchParams: URLSearchParams,
): LeadListFilters => {
  const sortByValue = searchParams.get("sortBy") ?? "";
  const sortOrderValue = searchParams.get("sortOrder") ?? "";
  const search = readOptionalText(searchParams.get("search"), 100);
  const jobId = readUuidFilter(searchParams.get("jobId"));
  const rawSource = searchParams.get("source");
  const source =
    rawSource === "fixture-business-directory" ||
    rawSource === "permitted-http-directory"
      ? rawSource
      : undefined;
  const category = readOptionalText(searchParams.get("category"), 150);
  const city = readOptionalText(searchParams.get("city"), 120);
  const state = readOptionalText(searchParams.get("state"), 100);
  const parsedCreatedFrom = readDateFilter(searchParams.get("createdFrom"));
  const parsedCreatedTo = readDateFilter(searchParams.get("createdTo"));
  const validDateRange =
    !parsedCreatedFrom ||
    !parsedCreatedTo ||
    parsedCreatedFrom <= parsedCreatedTo;
  const createdFrom = validDateRange ? parsedCreatedFrom : undefined;
  const createdTo = validDateRange ? parsedCreatedTo : undefined;
  const hasPhone = readOptionalBoolean(searchParams.get("hasPhone"));
  const hasEmail = readOptionalBoolean(searchParams.get("hasEmail"));
  const hasWebsite = readOptionalBoolean(searchParams.get("hasWebsite"));

  return {
    page: readBoundedInteger(searchParams.get("page"), 1, 1_000_000),
    pageSize: readBoundedInteger(searchParams.get("pageSize"), 25, 100),
    sortBy: isLeadSortField(sortByValue) ? sortByValue : "createdAt",
    sortOrder: isSortOrder(sortOrderValue) ? sortOrderValue : "desc",
    ...(search ? { search } : {}),
    ...(jobId ? { jobId } : {}),
    ...(source ? { source } : {}),
    ...(category ? { category } : {}),
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    ...(hasPhone !== undefined ? { hasPhone } : {}),
    ...(hasEmail !== undefined ? { hasEmail } : {}),
    ...(hasWebsite !== undefined ? { hasWebsite } : {}),
    ...(createdFrom ? { createdFrom } : {}),
    ...(createdTo ? { createdTo } : {}),
  };
};

export const serializeLeadFilters = (
  filters: LeadListFilters,
): URLSearchParams => {
  const params = new URLSearchParams();
  if (filters.page !== DEFAULT_LEAD_FILTERS.page) {
    params.set("page", String(filters.page));
  }
  if (filters.pageSize !== DEFAULT_LEAD_FILTERS.pageSize) {
    params.set("pageSize", String(filters.pageSize));
  }
  if (filters.search) params.set("search", filters.search);
  if (filters.jobId) params.set("jobId", filters.jobId);
  if (filters.source) params.set("source", filters.source);
  if (filters.category) params.set("category", filters.category);
  if (filters.city) params.set("city", filters.city);
  if (filters.state) params.set("state", filters.state);
  if (filters.hasPhone !== undefined) {
    params.set("hasPhone", String(filters.hasPhone));
  }
  if (filters.hasEmail !== undefined) {
    params.set("hasEmail", String(filters.hasEmail));
  }
  if (filters.hasWebsite !== undefined) {
    params.set("hasWebsite", String(filters.hasWebsite));
  }
  if (filters.sortBy !== DEFAULT_LEAD_FILTERS.sortBy) {
    params.set("sortBy", filters.sortBy);
  }
  if (filters.sortOrder !== DEFAULT_LEAD_FILTERS.sortOrder) {
    params.set("sortOrder", filters.sortOrder);
  }
  if (filters.createdFrom) params.set("createdFrom", filters.createdFrom);
  if (filters.createdTo) params.set("createdTo", filters.createdTo);
  return params;
};
