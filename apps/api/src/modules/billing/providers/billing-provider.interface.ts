export type CreateCustomerParams = {
  userId: string;
  email: string;
  name?: string;
};

export type CreateCheckoutSessionParams = {
  userId: string;
  customerId?: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey?: string | null;
};

export type CreatePortalSessionParams = {
  customerId: string;
  returnUrl: string;
};

export type ProviderSubscriptionResult = {
  id: string;
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  priceId?: string | null;
  customerId?: string | null;
};

export type ParsedWebhookEvent = {
  eventId: string;
  eventType: string;
  payload: unknown;
  created: number;
};

export interface BillingProviderAdapter {
  readonly providerName: "STRIPE" | "MANUAL" | "NONE";

  createOrGetCustomer(params: CreateCustomerParams): Promise<{ providerCustomerId: string }>;

  createCheckoutSession(params: CreateCheckoutSessionParams): Promise<{ sessionId: string; url: string }>;

  createBillingPortalSession(params: CreatePortalSessionParams): Promise<{ url: string }>;

  retrieveSubscription(providerSubscriptionId: string): Promise<ProviderSubscriptionResult | null>;

  cancelSubscription(
    providerSubscriptionId: string,
    cancelAtPeriodEnd?: boolean,
  ): Promise<{ id: string; status: string; cancelAtPeriodEnd: boolean }>;

  resumeSubscription(
    providerSubscriptionId: string,
  ): Promise<{ id: string; status: string; cancelAtPeriodEnd: boolean }>;

  updateSubscriptionPlan(
    providerSubscriptionId: string,
    newPriceId: string,
  ): Promise<{ id: string; status: string; priceId: string }>;

  verifyWebhookSignature(rawBody: string | Buffer, signature: string): Promise<boolean>;

  parseWebhookEvent(rawBody: string | Buffer, signature: string): Promise<ParsedWebhookEvent>;
}
