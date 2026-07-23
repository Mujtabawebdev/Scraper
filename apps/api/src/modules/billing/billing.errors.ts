import { AppError } from "../../common/errors/app-error.js";

export type BillingErrorCode =
  | "PLAN_NOT_FOUND"
  | "PLAN_PRICE_NOT_FOUND"
  | "SUBSCRIPTION_REQUIRED"
  | "SUBSCRIPTION_INACTIVE"
  | "SUBSCRIPTION_ALREADY_EXISTS"
  | "INVALID_PLAN_CHANGE"
  | "PLAN_LIMIT_EXCEEDED"
  | "BILLING_NOT_CONFIGURED"
  | "PAYMENT_PROVIDER_ERROR"
  | "USAGE_RESERVATION_EXPIRED"
  | "USAGE_RESERVATION_NOT_FOUND"
  | "WEBHOOK_VERIFICATION_FAILED"
  | "WEBHOOK_EVENT_ALREADY_PROCESSED";

export class BillingError extends AppError {
  declare readonly code: BillingErrorCode;

  constructor(statusCode: number, code: BillingErrorCode, message: string, details?: Record<string, unknown>) {
    super(statusCode, code, message, details ? { details } : {});
    this.name = "BillingError";
  }
}

export const planNotFoundError = (key?: string): BillingError =>
  new BillingError(404, "PLAN_NOT_FOUND", key ? `Plan '${key}' was not found` : "Requested plan was not found");

export const planPriceNotFoundError = (): BillingError =>
  new BillingError(404, "PLAN_PRICE_NOT_FOUND", "Pricing for the requested billing interval was not found");

export const subscriptionRequiredError = (): BillingError =>
  new BillingError(402, "SUBSCRIPTION_REQUIRED", "An active subscription is required to perform this action");

export const subscriptionInactiveError = (): BillingError =>
  new BillingError(402, "SUBSCRIPTION_INACTIVE", "Your subscription is not active or is past due. Please update your billing");

export const invalidPlanChangeError = (message = "Requested plan change is invalid"): BillingError =>
  new BillingError(400, "INVALID_PLAN_CHANGE", message);

export const planLimitExceededError = (details: {
  metric: string;
  limit: number | null;
  currentUsage: number;
  requestedQuantity: number;
  resetAt?: string;
  upgradeRequired?: boolean;
}): BillingError =>
  new BillingError(
    429,
    "PLAN_LIMIT_EXCEEDED",
    `Usage limit exceeded for ${details.metric}. Current: ${details.currentUsage}, Limit: ${details.limit ?? "unlimited"}, Requested: ${details.requestedQuantity}`,
    { ...details, upgradeRequired: true },
  );

export const billingNotConfiguredError = (): BillingError =>
  new BillingError(503, "BILLING_NOT_CONFIGURED", "Payment billing is not configured on this server");

export const paymentProviderError = (message = "An error occurred with the payment provider"): BillingError =>
  new BillingError(502, "PAYMENT_PROVIDER_ERROR", message);

export const usageReservationExpiredError = (): BillingError =>
  new BillingError(409, "USAGE_RESERVATION_EXPIRED", "Usage reservation has expired");
