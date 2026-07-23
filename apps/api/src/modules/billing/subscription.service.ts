import { prisma } from "../../infrastructure/database/prisma.js";
import { env } from "../../config/env.js";
import { getBillingProviderAdapter } from "./providers/billing-provider.factory.js";
import {
  findCustomerBillingProfile,
  findPlanByKey,
  findSubscriptionByProviderId,
  findUserActiveSubscription,
  createSubscriptionHistoryRecord,
  listUserInvoicesRepo,
  listUserPaymentsRepo,
} from "./billing.repository.js";
import {
  billingNotConfiguredError,
  invalidPlanChangeError,
  paymentProviderError,
  planNotFoundError,
  planPriceNotFoundError,
} from "./billing.errors.js";

export const getCurrentSubscriptionService = async (userId: string) => {
  let subscription = await findUserActiveSubscription(userId);
  if (!subscription) {
    subscription = await createFreeSubscriptionForUserService(userId);
  }
  return subscription;
};

export const createFreeSubscriptionForUserService = async (userId: string) => {
  const freePlan = await findPlanByKey("FREE");
  if (!freePlan) {
    throw planNotFoundError("FREE");
  }

  const existing = await findUserActiveSubscription(userId);
  if (existing) {
    return existing;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  const now = new Date();
  const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  return prisma.$transaction(async (tx) => {
    const sub = await tx.subscription.create({
      data: {
        userId,
        planId: freePlan.id,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: oneMonthLater,
        cancelAtPeriodEnd: false,
      },
      include: {
        plan: {
          include: {
            limits: true,
            prices: true,
          },
        },
        planPrice: true,
      },
    });

    await createSubscriptionHistoryRecord(tx, {
      subscriptionId: sub.id,
      userId,
      changeType: "CREATED",
      newPlanId: freePlan.id,
      newStatus: "ACTIVE",
      reason: "Initial free plan assignment",
    });

    return sub;
  });
};

export const createCheckoutSessionService = async (
  userId: string,
  input: {
    planKey: string;
    billingInterval: "MONTHLY" | "YEARLY";
    idempotencyKey?: string;
  },
) => {
  const plan = await findPlanByKey(input.planKey);
  if (!plan) throw planNotFoundError(input.planKey);

  const price = plan.prices.find((p) => p.billingInterval === input.billingInterval && p.isActive);
  if (!price) throw planPriceNotFoundError();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("USER_NOT_FOUND");

  const providerAdapter = getBillingProviderAdapter();
  if (providerAdapter.providerName === "NONE" && price.unitAmount > 0) {
    throw billingNotConfiguredError();
  }

  // Ensure CustomerBillingProfile exists
  let profile = await findCustomerBillingProfile(userId);
  let providerCustomerId = profile?.providerCustomerId ?? undefined;

  if (!profile || !providerCustomerId) {
    const cust = await providerAdapter.createOrGetCustomer({
      userId,
      email: user.email,
      name: user.fullName,
    });
    providerCustomerId = cust.providerCustomerId;

    profile = await prisma.customerBillingProfile.upsert({
      where: { userId },
      update: {
        billingProvider: providerAdapter.providerName,
        providerCustomerId,
        billingEmail: user.email,
      },
      create: {
        userId,
        billingProvider: providerAdapter.providerName,
        providerCustomerId,
        billingEmail: user.email,
      },
    });
  }

  if (price.unitAmount === 0 || !price.providerPriceId) {
    // If free or manual, directly upgrade in database
    await upgradeSubscriptionService(userId, input.planKey, input.billingInterval);
    return {
      sessionId: `direct_${Date.now()}`,
      url: `${env.BILLING_SUCCESS_URL}?plan=${input.planKey}`,
    };
  }

  const session = await providerAdapter.createCheckoutSession({
    userId,
    customerId: providerCustomerId,
    priceId: price.providerPriceId,
    successUrl: env.BILLING_SUCCESS_URL,
    cancelUrl: env.BILLING_CANCEL_URL,
    idempotencyKey: input.idempotencyKey ?? null,
  });

  return session;
};

export const createBillingPortalSessionService = async (userId: string) => {
  const profile = await findCustomerBillingProfile(userId);
  if (!profile?.providerCustomerId) {
    throw billingNotConfiguredError();
  }

  const providerAdapter = getBillingProviderAdapter(profile.billingProvider);
  return providerAdapter.createBillingPortalSession({
    customerId: profile.providerCustomerId,
    returnUrl: env.BILLING_PORTAL_RETURN_URL,
  });
};

export const upgradeSubscriptionService = async (
  userId: string,
  targetPlanKey: string,
  billingInterval: "MONTHLY" | "YEARLY" = "MONTHLY",
) => {
  const currentSub = await getCurrentSubscriptionService(userId);
  const targetPlan = await findPlanByKey(targetPlanKey);
  if (!targetPlan) throw planNotFoundError(targetPlanKey);

  const targetPrice = targetPlan.prices.find((p) => p.billingInterval === billingInterval);

  return prisma.$transaction(async (tx) => {
    const updatedSub = await tx.subscription.update({
      where: { id: currentSub.id },
      data: {
        planId: targetPlan.id,
        planPriceId: targetPrice?.id ?? null,
        status: "ACTIVE",
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
      include: {
        plan: { include: { limits: true, prices: true } },
        planPrice: true,
      },
    });

    await createSubscriptionHistoryRecord(tx, {
      subscriptionId: currentSub.id,
      userId,
      changeType: "UPGRADED",
      previousPlanId: currentSub.planId,
      newPlanId: targetPlan.id,
      previousStatus: currentSub.status,
      newStatus: "ACTIVE",
      reason: `Upgraded to ${targetPlan.name}`,
    });

    return updatedSub;
  });
};

export const downgradeSubscriptionService = async (
  userId: string,
  targetPlanKey: string,
) => {
  const currentSub = await getCurrentSubscriptionService(userId);
  const targetPlan = await findPlanByKey(targetPlanKey);
  if (!targetPlan) throw planNotFoundError(targetPlanKey);

  return prisma.$transaction(async (tx) => {
    const updatedSub = await tx.subscription.update({
      where: { id: currentSub.id },
      data: {
        planId: targetPlan.id,
        status: "ACTIVE",
      },
      include: {
        plan: { include: { limits: true, prices: true } },
        planPrice: true,
      },
    });

    await createSubscriptionHistoryRecord(tx, {
      subscriptionId: currentSub.id,
      userId,
      changeType: "DOWNGRADED",
      previousPlanId: currentSub.planId,
      newPlanId: targetPlan.id,
      previousStatus: currentSub.status,
      newStatus: "ACTIVE",
      reason: `Downgraded to ${targetPlan.name}`,
    });

    return updatedSub;
  });
};

export const scheduleCancellationService = async (userId: string, reason?: string) => {
  const currentSub = await getCurrentSubscriptionService(userId);
  if (currentSub.plan.key === "FREE") {
    throw invalidPlanChangeError("Cannot cancel a free subscription");
  }

  if (currentSub.providerSubscriptionId && currentSub.provider !== "NONE") {
    const adapter = getBillingProviderAdapter(currentSub.provider);
    await adapter.cancelSubscription(currentSub.providerSubscriptionId, true);
  }

  return prisma.$transaction(async (tx) => {
    const updatedSub = await tx.subscription.update({
      where: { id: currentSub.id },
      data: {
        cancelAtPeriodEnd: true,
        canceledAt: new Date(),
      },
      include: {
        plan: { include: { limits: true, prices: true } },
        planPrice: true,
      },
    });

    await createSubscriptionHistoryRecord(tx, {
      subscriptionId: currentSub.id,
      userId,
      changeType: "CANCEL_SCHEDULED",
      previousStatus: currentSub.status,
      newStatus: currentSub.status,
      reason: reason ?? "Scheduled cancellation at period end",
    });

    return updatedSub;
  });
};

export const cancelImmediatelyService = async (
  userId: string,
  actorUserId?: string,
  reason?: string,
) => {
  const currentSub = await getCurrentSubscriptionService(userId);

  if (currentSub.providerSubscriptionId && currentSub.provider !== "NONE") {
    const adapter = getBillingProviderAdapter(currentSub.provider);
    await adapter.cancelSubscription(currentSub.providerSubscriptionId, false);
  }

  const freePlan = await findPlanByKey("FREE");
  if (!freePlan) throw planNotFoundError("FREE");

  return prisma.$transaction(async (tx) => {
    const updatedSub = await tx.subscription.update({
      where: { id: currentSub.id },
      data: {
        planId: freePlan.id,
        status: "CANCELED",
        cancelAtPeriodEnd: false,
        endedAt: new Date(),
      },
      include: {
        plan: { include: { limits: true, prices: true } },
        planPrice: true,
      },
    });

    await createSubscriptionHistoryRecord(tx, {
      subscriptionId: currentSub.id,
      userId,
      changeType: "CANCELED",
      previousPlanId: currentSub.planId,
      newPlanId: freePlan.id,
      previousStatus: currentSub.status,
      newStatus: "CANCELED",
      actorUserId: actorUserId ?? null,
      reason: reason ?? "Immediate cancellation",
    });

    return updatedSub;
  });
};

export const resumeSubscriptionService = async (userId: string) => {
  const currentSub = await getCurrentSubscriptionService(userId);
  if (!currentSub.cancelAtPeriodEnd) {
    return currentSub;
  }

  if (currentSub.providerSubscriptionId && currentSub.provider !== "NONE") {
    const adapter = getBillingProviderAdapter(currentSub.provider);
    await adapter.resumeSubscription(currentSub.providerSubscriptionId);
  }

  return prisma.$transaction(async (tx) => {
    const updatedSub = await tx.subscription.update({
      where: { id: currentSub.id },
      data: {
        cancelAtPeriodEnd: false,
        canceledAt: null,
      },
      include: {
        plan: { include: { limits: true, prices: true } },
        planPrice: true,
      },
    });

    await createSubscriptionHistoryRecord(tx, {
      subscriptionId: currentSub.id,
      userId,
      changeType: "RESUMED",
      previousStatus: currentSub.status,
      newStatus: currentSub.status,
      reason: "Subscription cancellation revoked",
    });

    return updatedSub;
  });
};

export const getUserInvoicesService = async (userId: string, page = 1, pageSize = 20) => {
  return listUserInvoicesRepo(userId, page, pageSize);
};

export const getUserPaymentsService = async (userId: string, page = 1, pageSize = 20) => {
  return listUserPaymentsRepo(userId, page, pageSize);
};
