import { apiClient } from "../../../services/api-client";
import type {
  AdminQualityDashboardSummary,
  LeadDuplicateCandidateSummary,
  LeadMergePreview,
  LeadMergeResult,
  LeadQualitySummary,
  LeadVerificationHistoryItem,
  UserQualityDashboardSummary,
} from "@lead-saas/shared-types";

type ApiSuccessResponse<TData> = {
  success: true;
  message?: string;
  data: TData;
};

export const getLeadQualitySummary = async (leadId: string): Promise<LeadQualitySummary> => {
  const response = await apiClient.get<ApiSuccessResponse<LeadQualitySummary>>(
    `/leads/${encodeURIComponent(leadId)}/quality`
  );
  return response.data.data;
};

export const getLeadVerifications = async (leadId: string): Promise<LeadVerificationHistoryItem[]> => {
  const response = await apiClient.get<ApiSuccessResponse<LeadVerificationHistoryItem[]>>(
    `/leads/${encodeURIComponent(leadId)}/verifications`
  );
  return response.data.data;
};

export const verifySingleLead = async (leadId: string): Promise<any> => {
  const response = await apiClient.post<ApiSuccessResponse<any>>(
    `/leads/${encodeURIComponent(leadId)}/verify`
  );
  return response.data.data;
};

export const verifyBulkLeads = async (
  leadIds: string[],
  verificationTypes?: string[]
): Promise<any> => {
  const response = await apiClient.post<ApiSuccessResponse<any>>("/leads/verify-bulk", {
    leadIds,
    verificationTypes,
  });
  return response.data.data;
};

export const getDuplicateCandidates = async (leadId: string): Promise<LeadDuplicateCandidateSummary[]> => {
  const response = await apiClient.get<ApiSuccessResponse<LeadDuplicateCandidateSummary[]>>(
    `/leads/${encodeURIComponent(leadId)}/duplicate-candidates`
  );
  return response.data.data;
};

export const confirmDuplicateCandidate = async (leadId: string, candidateId: string): Promise<any> => {
  const response = await apiClient.post<ApiSuccessResponse<any>>(
    `/leads/${encodeURIComponent(leadId)}/duplicate-candidates/${encodeURIComponent(candidateId)}/confirm`
  );
  return response.data.data;
};

export const rejectDuplicateCandidate = async (leadId: string, candidateId: string): Promise<any> => {
  const response = await apiClient.post<ApiSuccessResponse<any>>(
    `/leads/${encodeURIComponent(leadId)}/duplicate-candidates/${encodeURIComponent(candidateId)}/reject`
  );
  return response.data.data;
};

export const previewMerge = async (
  canonicalLeadId: string,
  candidateLeadId: string
): Promise<LeadMergePreview> => {
  const response = await apiClient.post<ApiSuccessResponse<LeadMergePreview>>("/leads/merge/preview", {
    canonicalLeadId,
    candidateLeadId,
  });
  return response.data.data;
};

export const executeMerge = async (
  canonicalLeadId: string,
  candidateLeadId: string,
  reason?: string
): Promise<LeadMergeResult> => {
  const response = await apiClient.post<ApiSuccessResponse<LeadMergeResult>>("/leads/merge", {
    canonicalLeadId,
    candidateLeadId,
    reason,
  });
  return response.data.data;
};

export const getUserQualityDashboardSummary = async (): Promise<UserQualityDashboardSummary> => {
  const response = await apiClient.get<ApiSuccessResponse<UserQualityDashboardSummary>>(
    "/dashboard/quality"
  );
  return response.data.data;
};

export const getAdminQualityDashboardSummary = async (): Promise<AdminQualityDashboardSummary> => {
  const response = await apiClient.get<ApiSuccessResponse<AdminQualityDashboardSummary>>(
    "/admin/lead-quality/summary"
  );
  return response.data.data;
};
