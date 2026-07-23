export const billingQueryKeys = {
  all: ["billing"] as const,
  plans: () => [...billingQueryKeys.all, "plans"] as const,
  subscription: () => [...billingQueryKeys.all, "subscription"] as const,
  usage: () => [...billingQueryKeys.all, "usage"] as const,
  invoices: (page: number, pageSize: number) =>
    [...billingQueryKeys.all, "invoices", page, pageSize] as const,
  payments: (page: number, pageSize: number) =>
    [...billingQueryKeys.all, "payments", page, pageSize] as const,
  adminSummary: () => [...billingQueryKeys.all, "admin", "summary"] as const,
  adminPlans: () => [...billingQueryKeys.all, "admin", "plans"] as const,
  adminSubscriptions: (filters: Record<string, unknown>) =>
    [...billingQueryKeys.all, "admin", "subscriptions", filters] as const,
  adminSubscriptionDetail: (id: string) =>
    [...billingQueryKeys.all, "admin", "subscriptions", id] as const,
  adminWebhookEvents: (page: number) =>
    [...billingQueryKeys.all, "admin", "webhooks", page] as const,
};
