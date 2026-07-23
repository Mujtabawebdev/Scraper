export type PlanPriceDTO = {
  id: string;
  billingInterval: "MONTHLY" | "YEARLY" | "CUSTOM";
  currency: string;
  unitAmount: number;
  trialDays: number;
  isActive: boolean;
};

export type PlanLimitDTO = {
  id: string;
  metric:
    | "SCRAPING_JOBS"
    | "REQUESTED_LEADS"
    | "STORED_LEADS"
    | "CSV_EXPORTS"
    | "EXPORTED_LEADS"
    | "API_REQUESTS"
    | "WEBSITE_ENRICHMENTS"
    | "PHONE_ENRICHMENTS"
    | "TEAM_MEMBERS";
  hardLimit: number | null;
  softLimit: number | null;
  unlimited: boolean;
  resetInterval: string;
};

export type PlanSummary = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isActive: boolean;
  isPublic: boolean;
  displayOrder: number;
  prices: PlanPriceDTO[];
  limits: PlanLimitDTO[];
};

export type CurrentSubscriptionDTO = {
  id: string;
  userId: string;
  planId: string;
  planKey: string;
  planName: string;
  status:
    | "INCOMPLETE"
    | "TRIALING"
    | "ACTIVE"
    | "PAST_DUE"
    | "PAUSED"
    | "CANCELED"
    | "UNPAID"
    | "EXPIRED";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialStart: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  endedAt: string | null;
  plan: PlanSummary;
};

export type MetricEntitlementDTO = {
  metric: string;
  used: number;
  reserved: number;
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
  softLimit: number | null;
  resetInterval: string;
};

export type EntitlementsSummaryDTO = {
  planKey: string;
  planName: string;
  subscriptionStatus: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  metrics: MetricEntitlementDTO[];
};

export type InvoiceDTO = {
  id: string;
  number: string | null;
  currency: string;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  amountPaid: number;
  amountDue: number;
  status: "DRAFT" | "OPEN" | "PAID" | "VOID" | "UNCOLLECTIBLE";
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type PaymentDTO = {
  id: string;
  amount: number;
  currency: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED" | "CANCELED";
  failureMessage: string | null;
  paidAt: string | null;
  createdAt: string;
};

export type CheckoutSessionRequest = {
  planKey: string;
  billingInterval: "MONTHLY" | "YEARLY";
  idempotencyKey?: string;
};

export type CheckoutSessionResponse = {
  sessionId: string;
  url: string;
};

export type BillingPortalResponse = {
  url: string;
};

export type PlanChangeRequest = {
  targetPlanKey: string;
  billingInterval?: "MONTHLY" | "YEARLY";
};

export type CancelSubscriptionRequest = {
  reason?: string;
};

export type AdminSubscriptionSummary = {
  id: string;
  userId: string;
  userEmail: string;
  userFullName: string;
  planKey: string;
  planName: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
};

export type BillingWebhookEventSummary = {
  id: string;
  provider: string;
  providerEventId: string;
  eventType: string;
  status: string;
  attempts: number;
  lastError: string | null;
  receivedAt: string;
};

export type AdminBillingSummary = {
  totalSubscriptions: number;
  activePaidSubscriptions: number;
  freeUsersCount: number;
  trialingCount: number;
  pastDueCount: number;
  canceledThisPeriodCount: number;
  failedPaymentsCount: number;
  webhookFailuresCount: number;
  estimatedMRR: number;
};
