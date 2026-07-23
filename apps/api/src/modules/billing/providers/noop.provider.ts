import type {
  BillingProviderAdapter,
  CreateCheckoutSessionParams,
  CreateCustomerParams,
  CreatePortalSessionParams,
  ParsedWebhookEvent,
  ProviderSubscriptionResult,
} from "./billing-provider.interface.js";
import { AppError } from "../../../common/errors/app-error.js";

export class NoopBillingProvider implements BillingProviderAdapter {
  readonly providerName = "NONE";

  async createOrGetCustomer(params: CreateCustomerParams): Promise<{ providerCustomerId: string }> {
    return { providerCustomerId: `noop_cust_${params.userId}` };
  }

  async createCheckoutSession(_params: CreateCheckoutSessionParams): Promise<{ sessionId: string; url: string }> {
    throw new AppError(400, "BILLING_NOT_CONFIGURED", "Payment billing is currently not configured on this server");
  }

  async createBillingPortalSession(_params: CreatePortalSessionParams): Promise<{ url: string }> {
    throw new AppError(400, "BILLING_NOT_CONFIGURED", "Payment billing portal is currently not configured on this server");
  }

  async retrieveSubscription(_providerSubscriptionId: string): Promise<ProviderSubscriptionResult | null> {
    return null;
  }

  async cancelSubscription(providerSubscriptionId: string, cancelAtPeriodEnd = true): Promise<{ id: string; status: string; cancelAtPeriodEnd: boolean }> {
    return {
      id: providerSubscriptionId,
      status: "CANCELED",
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
    return false;
  }

  async parseWebhookEvent(_rawBody: string | Buffer, _signature: string): Promise<ParsedWebhookEvent> {
    throw new AppError(400, "PAYMENT_PROVIDER_ERROR", "Webhook signatures are disabled when billing is not configured");
  }
}
