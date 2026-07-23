import { apiClient } from "../../../services/api-client";
import type {
  LeadDetail,
  LeadProvenance,
  LeadListData,
  LeadListFilters,
} from "../types/lead.types";
import { getCsvExportFilename } from "../utils/csv-download";

type ApiSuccessResponse<TData> = {
  success: true;
  message?: string;
  data: TData;
};

const toLeadParams = (
  filters: LeadListFilters,
  includePagination: boolean,
): URLSearchParams => {
  const params = new URLSearchParams({
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  });
  if (includePagination) {
    params.set("page", String(filters.page));
    params.set("pageSize", String(filters.pageSize));
  }
  if (filters.search) params.set("search", filters.search);
  if (filters.jobId) params.set("jobId", filters.jobId);
  if (filters.source) params.set("source", filters.source);
  if (filters.sourceType) params.set("sourceType", filters.sourceType);
  if (filters.phoneValidationStatus) {
    params.set("phoneValidationStatus", filters.phoneValidationStatus);
  }
  if (filters.confidenceLevel) {
    params.set("confidenceLevel", filters.confidenceLevel);
  }
  if (filters.category) params.set("category", filters.category);
  if (filters.city) params.set("city", filters.city);
  if (filters.state) params.set("state", filters.state);
  if (filters.hasPhone !== undefined) {
    params.set("hasPhone", String(filters.hasPhone));
  }
  if (filters.hasValidPhone !== undefined) {
    params.set("hasValidPhone", String(filters.hasValidPhone));
  }
  if (filters.hasEmail !== undefined) {
    params.set("hasEmail", String(filters.hasEmail));
  }
  if (filters.hasWebsite !== undefined) {
    params.set("hasWebsite", String(filters.hasWebsite));
  }
  if (filters.createdFrom) params.set("createdFrom", filters.createdFrom);
  if (filters.createdTo) params.set("createdTo", filters.createdTo);
  if (filters.lastVerifiedFrom) {
    params.set("lastVerifiedFrom", filters.lastVerifiedFrom);
  }
  if (filters.lastVerifiedTo) {
    params.set("lastVerifiedTo", filters.lastVerifiedTo);
  }
  return params;
};

export const listLeads = async (
  filters: LeadListFilters,
): Promise<LeadListData> => {
  const response = await apiClient.get<ApiSuccessResponse<LeadListData>>(
    "/leads",
    { params: toLeadParams(filters, true) },
  );
  return response.data.data;
};

export const getLead = async (leadId: string): Promise<LeadDetail> => {
  const response = await apiClient.get<
    ApiSuccessResponse<{ lead: LeadDetail }>
  >(`/leads/${encodeURIComponent(leadId)}`);
  return response.data.data.lead;
};

export const getLeadProvenance = async (
  leadId: string,
): Promise<LeadProvenance[]> => {
  const response = await apiClient.get<
    ApiSuccessResponse<{ provenance: LeadProvenance[] }>
  >(`/leads/${encodeURIComponent(leadId)}/provenance`);
  return response.data.data.provenance;
};

export const verifyLeadPhone = async (
  leadId: string,
): Promise<LeadDetail> => {
  const response = await apiClient.post<
    ApiSuccessResponse<{ lead: LeadDetail }>
  >(`/leads/${encodeURIComponent(leadId)}/verify`);
  return response.data.data.lead;
};

export type LeadCsvExport = {
  blob: Blob;
  filename: string;
};

export const exportLeadsCsv = async (
  filters: LeadListFilters,
): Promise<LeadCsvExport> => {
  const response = await apiClient.get<Blob>("/leads/export.csv", {
    params: toLeadParams(filters, false),
    responseType: "blob",
  });
  const contentDisposition = response.headers["content-disposition"];

  return {
    blob: response.data,
    filename: getCsvExportFilename(
      typeof contentDisposition === "string" ? contentDisposition : undefined,
    ),
  };
};
