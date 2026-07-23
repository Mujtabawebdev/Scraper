import { prisma } from "../../infrastructure/database/prisma.js";
import type {
  BillingInterval,
  BillingProvider,
  InvoiceStatus,
  PaymentStatus,
  SubscriptionChangeType,
  SubscriptionStatus,
} from "../../generated/prisma/enums.js";

export type SubscriptionWithPlan = NonNullable<
  Awaited<ReturnType<typeof findUserActiveSubscription>>
>;

export const findUserActiveSubscription = async (userId: string) => {
  return prisma.subscription.findFirst({
    where: {
      userId,
      status: {
        in: ["ACTIVE", "TRIALING", "PAST_DUE", "PAUSED", "INCOMPLETE"],
      },
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
    orderBy: { createdAt: "desc" },
  });
};

export const findPlanByKey = async (key: string) => {
  return prisma.plan.findUnique({
    where: { key },
    include: {
      prices: { where: { isActive: true } },
      limits: true,
    },
  });
};

export const listPublicPlans = async () => {
  return prisma.plan.findMany({
    where: { isActive: true, isPublic: true },
    include: {
      prices: { where: { isActive: true } },
      limits: true,
    },
    orderBy: { displayOrder: "asc" },
  });
};

export const listAllPlansForAdmin = async () => {
  return prisma.plan.findMany({
    include: {
      prices: true,
      limits: true,
      _count: {
        select: { subscriptions: true },
      },
    },
    orderBy: { displayOrder: "asc" },
  });
};

export const findCustomerBillingProfile = async (userId: string) => {
  return prisma.customerBillingProfile.findUnique({
    where: { userId },
  });
};

export const findCustomerBillingProfileByProviderId = async (
  providerCustomerId: string,
) => {
  return prisma.customerBillingProfile.findUnique({
    where: { providerCustomerId },
    include: { user: true },
  });
};

export const findSubscriptionByProviderId = async (
  providerSubscriptionId: string,
) => {
  return prisma.subscription.findUnique({
    where: { providerSubscriptionId },
    include: {
      plan: { include: { limits: true, prices: true } },
      planPrice: true,
    },
  });
};

export const createSubscriptionHistoryRecord = async (
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  data: {
    subscriptionId: string;
    userId: string;
    changeType: SubscriptionChangeType;
    previousPlanId?: string | null;
    newPlanId?: string | null;
    previousStatus?: SubscriptionStatus | null;
    newStatus?: SubscriptionStatus | null;
    effectiveAt?: Date;
    actorUserId?: string | null;
    reason?: string | null;
    providerEventId?: string | null;
    metadata?: Record<string, unknown>;
  },
) => {
  return tx.subscriptionHistory.create({
    data: {
      subscriptionId: data.subscriptionId,
      userId: data.userId,
      changeType: data.changeType,
      previousPlanId: data.previousPlanId ?? null,
      newPlanId: data.newPlanId ?? null,
      previousStatus: data.previousStatus ?? null,
      newStatus: data.newStatus ?? null,
      effectiveAt: data.effectiveAt ?? new Date(),
      actorUserId: data.actorUserId ?? null,
      reason: data.reason ?? null,
      providerEventId: data.providerEventId ?? null,
      ...(data.metadata
        ? { metadata: data.metadata as unknown as import("../../generated/prisma/client.js").Prisma.InputJsonValue }
        : {}),
    },
  });
};

export const listUserInvoicesRepo = async (
  userId: string,
  page = 1,
  pageSize = 20,
) => {
  const skip = (page - 1) * pageSize;
  const [invoices, totalItems] = await Promise.all([
    prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.invoice.count({ where: { userId } }),
  ]);
  return { invoices, totalItems };
};

export const listUserPaymentsRepo = async (
  userId: string,
  page = 1,
  pageSize = 20,
) => {
  const skip = (page - 1) * pageSize;
  const [payments, totalItems] = await Promise.all([
    prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.payment.count({ where: { userId } }),
  ]);
  return { payments, totalItems };
};

export const listAdminSubscriptionsRepo = async (params: {
  page?: number;
  pageSize?: number;
  status?: SubscriptionStatus;
  planKey?: string;
  search?: string;
}) => {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  const where: import("../../generated/prisma/client.js").Prisma.SubscriptionWhereInput = {};

  if (params.status) {
    where.status = params.status;
  }
  if (params.planKey) {
    where.plan = { key: params.planKey };
  }
  if (params.search) {
    where.user = {
      OR: [
        { email: { contains: params.search, mode: "insensitive" } },
        { fullName: { contains: params.search, mode: "insensitive" } },
      ],
    };
  }

  const [subscriptions, totalItems] = await Promise.all([
    prisma.subscription.findMany({
      where,
      include: {
        user: { select: { id: true, email: true, fullName: true, role: true } },
        plan: true,
        planPrice: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.subscription.count({ where }),
  ]);

  return { subscriptions, totalItems };
};

export const getBillingMetricsSummary = async () => {
  const [
    totalSubscriptions,
    activePaidSubscriptions,
    freeUsersCount,
    trialingCount,
    pastDueCount,
    canceledThisPeriodCount,
    failedPaymentsCount,
    webhookFailuresCount,
    activeSubscriptionsWithPrices,
  ] = await Promise.all([
    prisma.subscription.count(),
    prisma.subscription.count({
      where: {
        status: "ACTIVE",
        plan: { key: { not: "FREE" } },
      },
    }),
    prisma.subscription.count({
      where: {
        status: "ACTIVE",
        plan: { key: "FREE" },
      },
    }),
    prisma.subscription.count({ where: { status: "TRIALING" } }),
    prisma.subscription.count({ where: { status: "PAST_DUE" } }),
    prisma.subscription.count({
      where: {
        status: "CANCELED",
        canceledAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.payment.count({ where: { status: "FAILED" } }),
    prisma.billingWebhookEvent.count({ where: { status: "FAILED" } }),
    prisma.subscription.findMany({
      where: { status: "ACTIVE" },
      include: { planPrice: true },
    }),
  ]);

  let estimatedMRR = 0;
  for (const sub of activeSubscriptionsWithPrices) {
    if (sub.planPrice) {
      if (sub.planPrice.billingInterval === "MONTHLY") {
        estimatedMRR += sub.planPrice.unitAmount;
      } else if (sub.planPrice.billingInterval === "YEARLY") {
        estimatedMRR += Math.round(sub.planPrice.unitAmount / 12);
      }
    }
  }

  return {
    totalSubscriptions,
    activePaidSubscriptions,
    freeUsersCount,
    trialingCount,
    pastDueCount,
    canceledThisPeriodCount,
    failedPaymentsCount,
    webhookFailuresCount,
    estimatedMRR,
  };
};
