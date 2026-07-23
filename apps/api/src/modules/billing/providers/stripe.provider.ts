import Stripe from "stripe";
import type {
  BillingProviderAdapter,
  CreateCheckoutSessionParams,
  CreateCustomerParams,
  CreatePortalSessionParams,
  ParsedWebhookEvent,
  ProviderSubscriptionResult,
} from "./billing-provider.interface.js";
import { AppError } from "../../../common/errors/app-error.js";
import { env } from "../../../config/env.js";

export class StripeBillingProvider implements BillingProviderAdapter {
  readonly providerName = "STRIPE";
  private readonly stripeClient: Stripe | null = null;

  constructor() {
    if (env.STRIPE_SECRET_KEY) {
      this.stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
        apiVersion: "2025-02-24.acacia",
      });
    }
  }

  private getStripe(): Stripe {
    if (!this.stripeClient) {
      throw new AppError(
        503,
        "BILLING_NOT_CONFIGURED",
        "Stripe billing credentials are not configured on this server",
      );
    }
    return this.stripeClient;
  }

  async createOrGetCustomer(params: CreateCustomerParams): Promise<{ providerCustomerId: string }> {
    const stripe = this.getStripe();
    const existing = await stripe.customers.search({
      query: `email:'${params.email.replace(/'/g, "\\'")}'`,
      limit: 1,
    });
    if (existing.data[0]) {
      return { providerCustomerId: existing.data[0].id };
    }
    const created = await stripe.customers.create({
      email: params.email,
      ...(params.name ? { name: params.name } : {}),
      metadata: { userId: params.userId },
    });
    return { providerCustomerId: created.id };
  }

  async createCheckoutSession(params: CreateCheckoutSessionParams): Promise<{ sessionId: string; url: string }> {
    const stripe = this.getStripe();

    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: params.userId,
      metadata: { userId: params.userId },
    };

    if (params.customerId) {
      sessionParams.customer = params.customerId;
    }

    const requestOptions: Stripe.RequestOptions = {};
    if (params.idempotencyKey) {
      requestOptions.idempotencyKey = params.idempotencyKey;
    }

    const session = await stripe.checkout.sessions.create(sessionParams, requestOptions);
    if (!session.url) {
      throw new AppError(500, "PAYMENT_PROVIDER_ERROR", "Stripe failed to return a checkout URL");
    }
    return { sessionId: session.id, url: session.url };
  }

  async createBillingPortalSession(params: CreatePortalSessionParams): Promise<{ url: string }> {
    const stripe = this.getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: params.customerId,
      return_url: params.returnUrl,
    });
    return { url: session.url };
  }

  async retrieveSubscription(providerSubscriptionId: string): Promise<ProviderSubscriptionResult | null> {
    const stripe = this.getStripe();
    try {
      const sub = await stripe.subscriptions.retrieve(providerSubscriptionId);
      const firstItem = sub.items.data[0];
      return {
        id: sub.id,
        status: sub.status.toUpperCase(),
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        priceId: firstItem?.price.id ?? null,
        customerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      };
    } catch {
      return null;
    }
  }

  async cancelSubscription(
    providerSubscriptionId: string,
    cancelAtPeriodEnd = true,
  ): Promise<{ id: string; status: string; cancelAtPeriodEnd: boolean }> {
    const stripe = this.getStripe();
    if (cancelAtPeriodEnd) {
      const sub = await stripe.subscriptions.update(providerSubscriptionId, {
        cancel_at_period_end: true,
      });
      return {
        id: sub.id,
        status: sub.status.toUpperCase(),
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      };
    } else {
      const sub = await stripe.subscriptions.cancel(providerSubscriptionId);
      return {
        id: sub.id,
        status: sub.status.toUpperCase(),
        cancelAtPeriodEnd: false,
      };
    }
  }

  async resumeSubscription(
    providerSubscriptionId: string,
  ): Promise<{ id: string; status: string; cancelAtPeriodEnd: boolean }> {
    const stripe = this.getStripe();
    const sub = await stripe.subscriptions.update(providerSubscriptionId, {
      cancel_at_period_end: false,
    });
    return {
      id: sub.id,
      status: sub.status.toUpperCase(),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    };
  }

  async updateSubscriptionPlan(
    providerSubscriptionId: string,
    newPriceId: string,
  ): Promise<{ id: string; status: string; priceId: string }> {
    const stripe = this.getStripe();
    const sub = await stripe.subscriptions.retrieve(providerSubscriptionId);
    const firstItem = sub.items.data[0];
    if (!firstItem) {
      throw new AppError(400, "PAYMENT_PROVIDER_ERROR", "Subscription contains no price items");
    }

    const updated = await stripe.subscriptions.update(providerSubscriptionId, {
      items: [
        {
          id: firstItem.id,
          price: newPriceId,
        },
      ],
      proration_behavior: "always_invoice",
    });

    const updatedItem = updated.items.data[0];
    return {
      id: updated.id,
      status: updated.status.toUpperCase(),
      priceId: updatedItem?.price.id ?? newPriceId,
    };
  }

  async verifyWebhookSignature(rawBody: string | Buffer, signature: string): Promise<boolean> {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      return false;
    }
    const stripe = this.getStripe();
    try {
      stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
      return true;
    } catch {
      return false;
    }
  }

  async parseWebhookEvent(rawBody: string | Buffer, signature: string): Promise<ParsedWebhookEvent> {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new AppError(400, "BILLING_NOT_CONFIGURED", "Stripe webhook secret is missing");
    }
    const stripe = this.getStripe();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch (err: unknown) {
      throw new AppError(
        400,
        "PAYMENT_PROVIDER_ERROR",
        `Webhook signature verification failed: ${err instanceof Error ? err.message : "Invalid signature"}`,
      );
    }

    return {
      eventId: event.id,
      eventType: event.type,
      payload: event.data.object,
      created: event.created,
    };
  }
}
