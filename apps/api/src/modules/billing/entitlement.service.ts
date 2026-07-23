import { prisma } from "../../infrastructure/database/prisma.js";
import type { UsageMetric } from "../../generated/prisma/enums.js";
import { findUserActiveSubscription, findPlanByKey } from "./billing.repository.js";
import { getOrCreateCurrentUsagePeriod, getUsageCounterValue, getReservedUsageValue } from "./usage.service.js";
import { planLimitExceededError, subscriptionInactiveError } from "./billing.errors.js";

export type MetricEntitlementDTO = {
  metric: UsageMetric;
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

export const getEntitlementsForUser = async (userId: string): Promise<EntitlementsSummaryDTO> => {
  let subscription = await findUserActiveSubscription(userId);

  // If user has no active subscription, automatically assign FREE plan
  if (!subscription) {
    const freePlan = await findPlanByKey("FREE");
    if (!freePlan) {
      throw new Error("DEFAULT_FREE_PLAN_NOT_FOUND");
    }
    const now = new Date();
    const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    subscription = await prisma.subscription.create({
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
  }

  const usagePeriod = await getOrCreateCurrentUsagePeriod(userId, subscription.id);
  const plan = subscription.plan;

  const metricsList: UsageMetric[] = [
    "SCRAPING_JOBS",
    "REQUESTED_LEADS",
    "STORED_LEADS",
    "CSV_EXPORTS",
    "EXPORTED_LEADS",
    "API_REQUESTS",
    "WEBSITE_ENRICHMENTS",
    "PHONE_ENRICHMENTS",
    "TEAM_MEMBERS",
  ];

  const metrics: MetricEntitlementDTO[] = metricsList.map((metric) => {
    const limitDef = plan.limits.find((l) => l.metric === metric);
    const used = getUsageCounterValue(usagePeriod, metric);
    const reserved = getReservedUsageValue(usagePeriod, metric);
    const totalConsumedAndPending = used + reserved;

    const isUnlimited = limitDef?.unlimited ?? false;
    const hardLimit = isUnlimited ? null : (limitDef?.hardLimit ?? null);
    const remaining = isUnlimited || hardLimit === null ? null : Math.max(0, hardLimit - totalConsumedAndPending);

    return {
      metric,
      used,
      reserved,
      limit: hardLimit,
      remaining,
      unlimited: isUnlimited,
      softLimit: limitDef?.softLimit ?? null,
      resetInterval: limitDef?.resetInterval ?? "monthly",
    };
  });

  return {
    planKey: plan.key,
    planName: plan.name,
    subscriptionStatus: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart.toISOString(),
    currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    metrics,
  };
};

export const assertCanConsume = async (
  userId: string,
  metric: UsageMetric,
  requestedQuantity = 1,
): Promise<MetricEntitlementDTO> => {
  const summary = await getEntitlementsForUser(userId);

  if (summary.subscriptionStatus === "CANCELED" || summary.subscriptionStatus === "EXPIRED" || summary.subscriptionStatus === "UNPAID") {
    // If canceled but within period end, allow access
    const periodEnd = new Date(summary.currentPeriodEnd);
    if (new Date() > periodEnd) {
      throw subscriptionInactiveError();
    }
  }

  const metricEntitlement = summary.metrics.find((m) => m.metric === metric);
  if (!metricEntitlement) {
    return {
      metric,
      used: 0,
      reserved: 0,
      limit: null,
      remaining: null,
      unlimited: true,
      softLimit: null,
      resetInterval: "monthly",
    };
  }

  if (!metricEntitlement.unlimited && metricEntitlement.limit !== null) {
    const pendingTotal = metricEntitlement.used + metricEntitlement.reserved + requestedQuantity;
    if (pendingTotal > metricEntitlement.limit) {
      throw planLimitExceededError({
        metric,
        limit: metricEntitlement.limit,
        currentUsage: metricEntitlement.used + metricEntitlement.reserved,
        requestedQuantity,
        resetAt: summary.currentPeriodEnd,
        upgradeRequired: true,
      });
    }
  }

  return metricEntitlement;
};
