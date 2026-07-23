import { apiClient } from "../../../services/api-client";
import type {
  CreateScrapingJobRequest,
  ScrapingJobDetail,
  ScrapingJobListData,
  ScrapingJobListFilters,
  ScrapingJobSummary,
} from "../types/scraping-job.types";

type ApiSuccessResponse<TData> = {
  success: true;
  message?: string;
  data: TData;
};

const toListParams = (filters: ScrapingJobListFilters): URLSearchParams => {
  const params = new URLSearchParams({
    page: String(filters.page),
    pageSize: String(filters.pageSize),
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  });
  if (filters.status) params.set("status", filters.status);
  if (filters.source) params.set("source", filters.source);
  if (filters.search) params.set("search", filters.search);
  if (filters.createdFrom) params.set("createdFrom", filters.createdFrom);
  if (filters.createdTo) params.set("createdTo", filters.createdTo);
  return params;
};

export const createScrapingJob = async (
  input: CreateScrapingJobRequest,
): Promise<ScrapingJobSummary> => {
  const response = await apiClient.post<
    ApiSuccessResponse<{ job: ScrapingJobSummary }>
  >("/scraping-jobs", input);
  return response.data.data.job;
};

export const listScrapingJobs = async (
  filters: ScrapingJobListFilters,
): Promise<ScrapingJobListData> => {
  const response = await apiClient.get<ApiSuccessResponse<ScrapingJobListData>>(
    "/scraping-jobs",
    { params: toListParams(filters) },
  );
  return response.data.data;
};

export const getScrapingJob = async (
  jobId: string,
): Promise<ScrapingJobDetail> => {
  const response = await apiClient.get<
    ApiSuccessResponse<{ job: ScrapingJobDetail }>
  >(`/scraping-jobs/${encodeURIComponent(jobId)}`);
  return response.data.data.job;
};

export const cancelScrapingJob = async (
  jobId: string,
): Promise<ScrapingJobDetail> => {
  const response = await apiClient.post<
    ApiSuccessResponse<{ job: ScrapingJobDetail }>
  >(`/scraping-jobs/${encodeURIComponent(jobId)}/cancel`, {});
  return response.data.data.job;
};

export const retryScrapingJob = async (
  jobId: string,
): Promise<ScrapingJobSummary> => {
  const response = await apiClient.post<
    ApiSuccessResponse<{ job: ScrapingJobSummary }>
  >(`/scraping-jobs/${encodeURIComponent(jobId)}/retry`, {});
  return response.data.data.job;
};
