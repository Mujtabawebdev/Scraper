import type {
  AdminBillingSummary,
  AdminSubscriptionSummary,
  BillingPortalResponse,
  BillingWebhookEventSummary,
  CancelSubscriptionRequest,
  CheckoutSessionRequest,
  CheckoutSessionResponse,
  CurrentSubscriptionDTO,
  EntitlementsSummaryDTO,
  InvoiceDTO,
  PaymentDTO,
  PlanChangeRequest,
  PlanSummary,
} from "@lead-saas/shared-types";
import { apiClient } from "../../../services/api-client";

type ApiSuccessResponse<TData> = {
  success: true;
  message?: string;
  data: TData;
};

export const fetchPublicPlans = async (): Promise<PlanSummary[]> => {
  const res = await apiClient.get<ApiSuccessResponse<{ plans: PlanSummary[] }>>("/billing/plans");
  return res.data.data.plans;
};

export const fetchCurrentSubscription = async (): Promise<CurrentSubscriptionDTO> => {
  const res = await apiClient.get<ApiSuccessResponse<{ subscription: CurrentSubscriptionDTO }>>(
    "/billing/subscription",
  );
  return res.data.data.subscription;
};

export const fetchUsageSummary = async (): Promise<EntitlementsSummaryDTO> => {
  const res = await apiClient.get<ApiSuccessResponse<{ usage: EntitlementsSummaryDTO }>>(
    "/billing/usage",
  );
  return res.data.data.usage;
};

export const fetchUserInvoices = async (
  page = 1,
  pageSize = 20,
): Promise<{ invoices: InvoiceDTO[]; totalItems: number }> => {
  const res = await apiClient.get<
    ApiSuccessResponse<{ invoices: InvoiceDTO[]; totalItems: number }>
  >("/billing/invoices", { params: { page, pageSize } });
  return res.data.data;
};

export const fetchUserPayments = async (
  page = 1,
  pageSize = 20,
): Promise<{ payments: PaymentDTO[]; totalItems: number }> => {
  const res = await apiClient.get<
    ApiSuccessResponse<{ payments: PaymentDTO[]; totalItems: number }>
  >("/billing/payments", { params: { page, pageSize } });
  return res.data.data;
};

export const requestCheckoutSession = async (
  input: CheckoutSessionRequest,
): Promise<CheckoutSessionResponse> => {
  const res = await apiClient.post<ApiSuccessResponse<CheckoutSessionResponse>>(
    "/billing/checkout-session",
    input,
  );
  return res.data.data;
};

export const requestBillingPortalSession = async (): Promise<BillingPortalResponse> => {
  const res = await apiClient.post<ApiSuccessResponse<BillingPortalResponse>>(
    "/billing/portal-session",
    {},
  );
  return res.data.data;
};

export const requestChangePlan = async (
  input: PlanChangeRequest,
): Promise<CurrentSubscriptionDTO> => {
  const res = await apiClient.post<
    ApiSuccessResponse<{ subscription: CurrentSubscriptionDTO }>
  >("/billing/change-plan", input);
  return res.data.data.subscription;
};

export const requestCancelSubscription = async (
  input: CancelSubscriptionRequest,
): Promise<CurrentSubscriptionDTO> => {
  const res = await apiClient.post<
    ApiSuccessResponse<{ subscription: CurrentSubscriptionDTO }>
  >("/billing/cancel", input);
  return res.data.data.subscription;
};

export const requestResumeSubscription = async (): Promise<CurrentSubscriptionDTO> => {
  const res = await apiClient.post<
    ApiSuccessResponse<{ subscription: CurrentSubscriptionDTO }>
  >("/billing/resume", {});
  return res.data.data.subscription;
};

// Admin billing API calls
export const fetchAdminBillingSummary = async (): Promise<AdminBillingSummary> => {
  const res = await apiClient.get<ApiSuccessResponse<{ summary: AdminBillingSummary }>>(
    "/admin/billing/summary",
  );
  return res.data.data.summary;
};

export const fetchAdminPlans = async (): Promise<PlanSummary[]> => {
  const res = await apiClient.get<ApiSuccessResponse<{ plans: PlanSummary[] }>>(
    "/admin/billing/plans",
  );
  return res.data.data.plans;
};

export const fetchAdminSubscriptions = async (params: {
  page?: number;
  pageSize?: number;
  status?: string;
  planKey?: string;
  search?: string;
}): Promise<{ subscriptions: AdminSubscriptionSummary[]; totalItems: number }> => {
  const res = await apiClient.get<
    ApiSuccessResponse<{ subscriptions: AdminSubscriptionSummary[]; totalItems: number }>
  >("/admin/billing/subscriptions", { params });
  return res.data.data;
};
