import { createHash } from "node:crypto";
import type { Request, Response } from "express";
import { prisma } from "../../infrastructure/database/prisma.js";
import { logger } from "../../common/logger/logger.js";
import { getBillingProviderAdapter } from "./providers/billing-provider.factory.js";
import {
  findCustomerBillingProfileByProviderId,
  findPlanByKey,
  createSubscriptionHistoryRecord,
} from "./billing.repository.js";

export const handleStripeWebhook = async (request: Request, response: Response): Promise<void> => {
  const signature = request.get("stripe-signature");
  if (!signature) {
    response.status(400).json({
      success: false,
      message: "Missing webhook signature header",
      error: { code: "WEBHOOK_VERIFICATION_FAILED" },
    });
    return;
  }

  const rawBody = (request as unknown as { rawBody?: Buffer | string }).rawBody ?? request.body;

  const adapter = getBillingProviderAdapter("STRIPE");
  let event: Awaited<ReturnType<typeof adapter.parseWebhookEvent>>;
  try {
    event = await adapter.parseWebhookEvent(rawBody, signature);
  } catch (error: unknown) {
    logger.warn(
      { errorType: error instanceof Error ? error.name : "UnknownError" },
      "Stripe webhook signature verification failed",
    );
    response.status(400).json({
      success: false,
      message: "Invalid webhook signature",
      error: { code: "WEBHOOK_VERIFICATION_FAILED" },
    });
    return;
  }

  const payloadHash = createHash("sha256")
    .update(typeof rawBody === "string" ? rawBody : JSON.stringify(event.payload))
    .digest("hex");

  // Deduplication check
  const existingEvent = await prisma.billingWebhookEvent.findUnique({
    where: { providerEventId: event.eventId },
  });

  if (existingEvent) {
    if (existingEvent.status === "PROCESSED" || existingEvent.status === "IGNORED") {
      response.status(200).json({
        success: true,
        message: "Event already processed",
        data: { eventId: event.eventId, status: existingEvent.status },
      });
      return;
    }
  }

  const webhookRecord = existingEvent
    ? await prisma.billingWebhookEvent.update({
        where: { id: existingEvent.id },
        data: {
          status: "PROCESSING",
          attempts: { increment: 1 },
        },
      })
    : await prisma.billingWebhookEvent.create({
        data: {
          provider: "STRIPE",
          providerEventId: event.eventId,
          eventType: event.eventType,
          payloadHash,
          status: "PROCESSING",
          attempts: 1,
          receivedAt: new Date(event.created * 1000),
        },
      });

  try {
    await processWebhookPayload(event.eventType, event.payload, event.eventId);

    await prisma.billingWebhookEvent.update({
      where: { id: webhookRecord.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
      },
    });

    response.status(200).json({
      success: true,
      message: "Webhook event processed successfully",
      data: { eventId: event.eventId },
    });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : "Processing error";
    logger.error(
      { eventId: event.eventId, eventType: event.eventType, error: errorMessage },
      "Billing webhook processing failed",
    );

    await prisma.billingWebhookEvent.update({
      where: { id: webhookRecord.id },
      data: {
        status: "FAILED",
        lastError: errorMessage,
      },
    });

    response.status(500).json({
      success: false,
      message: "Webhook event processing failed",
      error: { code: "WEBHOOK_PROCESSING_FAILED" },
    });
  }
};

const processWebhookPayload = async (
  eventType: string,
  payload: unknown,
  eventId: string,
): Promise<void> => {
  const obj = payload as Record<string, unknown>;

  switch (eventType) {
    case "checkout.session.completed": {
      const customerId = obj.customer as string | undefined;
      const subscriptionId = obj.subscription as string | undefined;
      const clientReferenceId = obj.client_reference_id as string | undefined;
      if (customerId && subscriptionId) {
        await syncStripeSubscription(subscriptionId, customerId, clientReferenceId, eventId);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscriptionId = obj.id as string | undefined;
      const customerId = obj.customer as string | undefined;
      if (subscriptionId && customerId) {
        await syncStripeSubscription(subscriptionId, customerId, undefined, eventId);
      }
      break;
    }
    case "invoice.paid":
    case "invoice.payment_failed": {
      const invoiceId = obj.id as string | undefined;
      const customerId = obj.customer as string | undefined;
      const subscriptionId = obj.subscription as string | undefined;
      const total = (obj.amount_paid as number) ?? (obj.total as number) ?? 0;
      const status = eventType === "invoice.paid" ? "PAID" : "OPEN";

      if (customerId) {
        const profile = await findCustomerBillingProfileByProviderId(customerId);
        if (profile) {
          await prisma.invoice.upsert({
            where: { providerInvoiceId: invoiceId ?? `inv_${Date.now()}` },
            update: {
              status,
              amountPaid: (obj.amount_paid as number) ?? 0,
              paidAt: eventType === "invoice.paid" ? new Date() : null,
            },
            create: {
              userId: profile.userId,
              subscriptionId: subscriptionId
                ? ((await prisma.subscription.findUnique({ where: { providerSubscriptionId: subscriptionId } }))?.id ?? null)
                : null,
              provider: "STRIPE",
              providerInvoiceId: invoiceId ?? `inv_${Date.now()}`,
              number: (obj.number as string | null) ?? null,
              currency: (obj.currency as string) ?? "usd",
              subtotalAmount: (obj.subtotal as number) ?? total,
              totalAmount: total,
              amountPaid: (obj.amount_paid as number) ?? 0,
              amountDue: (obj.amount_due as number) ?? 0,
              status,
              hostedInvoiceUrl: (obj.hosted_invoice_url as string | null) ?? null,
              invoicePdfUrl: (obj.invoice_pdf_url as string | null) ?? null,
              paidAt: eventType === "invoice.paid" ? new Date() : null,
            },
          });
        }
      }
      break;
    }
    default: {
      logger.info({ eventType }, "Billing webhook event type ignored");
    }
  }
};

const syncStripeSubscription = async (
  stripeSubId: string,
  stripeCustomerId: string,
  clientUserId?: string,
  eventId?: string,
): Promise<void> => {
  const adapter = getBillingProviderAdapter("STRIPE");
  const subData = await adapter.retrieveSubscription(stripeSubId);
  if (!subData) return;

  const profile = await findCustomerBillingProfileByProviderId(stripeCustomerId);
  const userId = profile?.userId ?? clientUserId;
  if (!userId) return;

  // Resolve plan from price ID or fallback to STARTER/PRO
  let targetPlan = await findPlanByKey("STARTER");
  let planPriceId: string | undefined;

  if (subData.priceId) {
    const priceRecord = await prisma.planPrice.findFirst({
      where: { providerPriceId: subData.priceId },
      include: { plan: { include: { limits: true, prices: true } } },
    });
    if (priceRecord) {
      targetPlan = priceRecord.plan;
      planPriceId = priceRecord.id;
    }
  }

  const existingSub = await prisma.subscription.findUnique({
    where: { providerSubscriptionId: stripeSubId },
  });

  const internalStatus = mapStripeStatusToInternal(subData.status);

  if (existingSub) {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.subscription.update({
        where: { id: existingSub.id },
        data: {
          planId: targetPlan?.id ?? existingSub.planId,
          planPriceId: planPriceId ?? existingSub.planPriceId,
          status: internalStatus,
          currentPeriodStart: subData.currentPeriodStart,
          currentPeriodEnd: subData.currentPeriodEnd,
          cancelAtPeriodEnd: subData.cancelAtPeriodEnd,
          version: { increment: 1 },
        },
      });

      await createSubscriptionHistoryRecord(tx, {
        subscriptionId: updated.id,
        userId,
        changeType: "ACTIVATED",
        previousStatus: existingSub.status,
        newStatus: internalStatus,
        providerEventId: eventId ?? null,
        reason: `Synced from Stripe webhook (${subData.status})`,
      });
    });
  } else {
    await prisma.$transaction(async (tx) => {
      const created = await tx.subscription.create({
        data: {
          userId,
          planId: targetPlan?.id ?? (await findPlanByKey("FREE"))!.id,
          planPriceId: planPriceId ?? null,
          billingProfileId: profile?.id ?? null,
          provider: "STRIPE",
          providerSubscriptionId: stripeSubId,
          status: internalStatus,
          currentPeriodStart: subData.currentPeriodStart,
          currentPeriodEnd: subData.currentPeriodEnd,
          cancelAtPeriodEnd: subData.cancelAtPeriodEnd,
        },
      });

      await createSubscriptionHistoryRecord(tx, {
        subscriptionId: created.id,
        userId,
        changeType: "ACTIVATED",
        newStatus: internalStatus,
        providerEventId: eventId ?? null,
        reason: `Activated via Stripe webhook (${subData.status})`,
      });
    });
  }
};

const mapStripeStatusToInternal = (status: string): import("../../generated/prisma/enums.js").SubscriptionStatus => {
  switch (status.toUpperCase()) {
    case "ACTIVE":
      return "ACTIVE";
    case "TRIALING":
      return "TRIALING";
    case "PAST_DUE":
      return "PAST_DUE";
    case "CANCELED":
      return "CANCELED";
    case "UNPAID":
      return "UNPAID";
    case "PAUSED":
      return "PAUSED";
    default:
      return "INCOMPLETE";
  }
};
