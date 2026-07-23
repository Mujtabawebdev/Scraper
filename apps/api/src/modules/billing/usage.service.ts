import { randomUUID } from "node:crypto";
import { prisma } from "../../infrastructure/database/prisma.js";
import type { UsageMetric } from "../../generated/prisma/enums.js";
import {
  findUserActiveSubscription,
  createSubscriptionHistoryRecord,
} from "./billing.repository.js";
import { planLimitExceededError, planNotFoundError } from "./billing.errors.js";

export type CurrentUsagePeriodRecord = Awaited<ReturnType<typeof getOrCreateCurrentUsagePeriod>>;

export const getOrCreateCurrentUsagePeriod = async (userId: string, subscriptionId?: string | null) => {
  const now = new Date();

  // Find existing period covering now
  const existing = await prisma.usagePeriod.findFirst({
    where: {
      userId,
      periodStart: { lte: now },
      periodEnd: { gte: now },
    },
    include: {
      counters: true,
      reservations: { where: { status: "RESERVED" } },
    },
  });

  if (existing) {
    return existing;
  }

  // Calculate period start and end (1st of month to 1st of next month)
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, -1));

  return prisma.usagePeriod.upsert({
    where: {
      userId_periodStart_periodEnd: {
        userId,
        periodStart,
        periodEnd,
      },
    },
    update: {
      ...(subscriptionId ? { subscriptionId } : {}),
    },
    create: {
      userId,
      subscriptionId: subscriptionId ?? null,
      periodStart,
      periodEnd,
    },
    include: {
      counters: true,
      reservations: { where: { status: "RESERVED" } },
    },
  });
};

export const getUsageCounterValue = (
  usagePeriod: CurrentUsagePeriodRecord,
  metric: UsageMetric,
): number => {
  const counter = usagePeriod.counters.find((c) => c.metric === metric);
  return counter?.quantity ?? 0;
};

export const getReservedUsageValue = (
  usagePeriod: CurrentUsagePeriodRecord,
  metric: UsageMetric,
): number => {
  const now = new Date();
  return usagePeriod.reservations
    .filter((r) => r.metric === metric && r.status === "RESERVED" && (!r.expiresAt || r.expiresAt > now))
    .reduce((sum, r) => sum + r.quantity, 0);
};

export const reserveUsage = async (
  userId: string,
  metric: UsageMetric,
  quantity: number,
  referenceType: string,
  referenceId?: string,
  customIdempotencyKey?: string,
  ttlMinutes = 30,
) => {
  if (quantity <= 0) return null;

  const idempotencyKey = customIdempotencyKey ?? `res_${referenceType}_${referenceId ?? randomUUID()}_${metric}`;

  // Check if idempotency key already exists
  const existingReservation = await prisma.usageReservation.findUnique({
    where: { idempotencyKey },
  });
  if (existingReservation) {
    return existingReservation;
  }

  const subscription = await findUserActiveSubscription(userId);
  const plan = subscription?.plan;
  const limit = plan?.limits.find((l) => l.metric === metric);

  const usagePeriod = await getOrCreateCurrentUsagePeriod(userId, subscription?.id);
  const currentCounter = getUsageCounterValue(usagePeriod, metric);
  const currentReserved = getReservedUsageValue(usagePeriod, metric);
  const totalPendingUsage = currentCounter + currentReserved;

  if (limit && !limit.unlimited && limit.hardLimit !== null && limit.hardLimit !== undefined) {
    if (totalPendingUsage + quantity > limit.hardLimit) {
      throw planLimitExceededError({
        metric,
        limit: limit.hardLimit,
        currentUsage: totalPendingUsage,
        requestedQuantity: quantity,
        resetAt: usagePeriod.periodEnd.toISOString(),
      });
    }
  }

  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  return prisma.usageReservation.create({
    data: {
      userId,
      usagePeriodId: usagePeriod.id,
      metric,
      quantity,
      status: "RESERVED",
      idempotencyKey,
      expiresAt,
      referenceType,
      referenceId: referenceId ?? null,
    },
  });
};

export const consumeReservation = async (idempotencyKey: string) => {
  const reservation = await prisma.usageReservation.findUnique({
    where: { idempotencyKey },
  });
  if (!reservation || reservation.status !== "RESERVED") {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const updatedRes = await tx.usageReservation.update({
      where: { id: reservation.id },
      data: { status: "CONSUMED" },
    });

    await tx.usageCounter.upsert({
      where: {
        usagePeriodId_metric: {
          usagePeriodId: reservation.usagePeriodId,
          metric: reservation.metric,
        },
      },
      update: {
        quantity: { increment: reservation.quantity },
      },
      create: {
        usagePeriodId: reservation.usagePeriodId,
        metric: reservation.metric,
        quantity: reservation.quantity,
      },
    });

    return updatedRes;
  });
};

export const releaseReservation = async (idempotencyKey: string) => {
  const reservation = await prisma.usageReservation.findUnique({
    where: { idempotencyKey },
  });
  if (!reservation || reservation.status !== "RESERVED") {
    return null;
  }

  return prisma.usageReservation.update({
    where: { id: reservation.id },
    data: { status: "RELEASED" },
  });
};

export const incrementUsageDirectly = async (
  userId: string,
  metric: UsageMetric,
  quantity = 1,
) => {
  if (quantity <= 0) return;

  const subscription = await findUserActiveSubscription(userId);
  const usagePeriod = await getOrCreateCurrentUsagePeriod(userId, subscription?.id);

  return prisma.usageCounter.upsert({
    where: {
      usagePeriodId_metric: {
        usagePeriodId: usagePeriod.id,
        metric,
      },
    },
    update: {
      quantity: { increment: quantity },
    },
    create: {
      usagePeriodId: usagePeriod.id,
      metric,
      quantity,
    },
  });
};

export const expireStaleReservations = async (): Promise<number> => {
  const now = new Date();
  const result = await prisma.usageReservation.updateMany({
    where: {
      status: "RESERVED",
      expiresAt: { lt: now },
    },
    data: {
      status: "EXPIRED",
    },
  });
  return result.count;
};
