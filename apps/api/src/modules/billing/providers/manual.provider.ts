import type {
  BillingProviderAdapter,
  CreateCheckoutSessionParams,
  CreateCustomerParams,
  CreatePortalSessionParams,
  ParsedWebhookEvent,
  ProviderSubscriptionResult,
} from "./billing-provider.interface.js";
import { AppError } from "../../../common/errors/app-error.js";

export class ManualBillingProvider implements BillingProviderAdapter {
  readonly providerName = "MANUAL";

  async createOrGetCustomer(params: CreateCustomerParams): Promise<{ providerCustomerId: string }> {
    return { providerCustomerId: `manual_cust_${params.userId}` };
  }

  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<{ sessionId: string; url: string }> {
    // Manual/Enterprise accounts don't use self-serve Stripe checkout
    return {
      sessionId: `manual_session_${Date.now()}`,
      url: params.successUrl,
    };
  }

  async createBillingPortalSession(params: CreatePortalSessionParams): Promise<{ url: string }> {
    return { url: params.returnUrl };
  }

  async retrieveSubscription(providerSubscriptionId: string): Promise<ProviderSubscriptionResult | null> {
    const now = new Date();
    const oneYearLater = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    return {
      id: providerSubscriptionId,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: oneYearLater,
      cancelAtPeriodEnd: false,
    };
  }

  async cancelSubscription(providerSubscriptionId: string, cancelAtPeriodEnd = true): Promise<{ id: string; status: string; cancelAtPeriodEnd: boolean }> {
    return {
      id: providerSubscriptionId,
      status: cancelAtPeriodEnd ? "ACTIVE" : "CANCELED",
      cancelAtPeriodEnd,
    };
  }

  async resumeSubscription(providerSubscriptionId: string): Promise<{ id: string; status: string; cancelAtPeriodEnd: boolean }> {
    return {
      id: providerSubscriptionId,
      status: "ACTIVE",
      cancelAtPeriodEnd: false,
    };
  }

  async updateSubscriptionPlan(providerSubscriptionId: string, newPriceId: string): Promise<{ id: string; status: string; priceId: string }> {
    return {
      id: providerSubscriptionId,
      status: "ACTIVE",
      priceId: newPriceId,
    };
  }

  async verifyWebhookSignature(_rawBody: string | Buffer, _signature: string): Promise<boolean> {
    return true;
  }

  async parseWebhookEvent(_rawBody: string | Buffer, _signature: string): Promise<ParsedWebhookEvent> {
    throw new AppError(400, "PAYMENT_PROVIDER_ERROR", "Manual provider does not process external webhook payloads");
  }
}
