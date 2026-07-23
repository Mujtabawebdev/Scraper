import type { Request, Response } from "express";
import { prisma } from "../../infrastructure/database/prisma.js";
import {
  getBillingMetricsSummary,
  listAdminSubscriptionsRepo,
  listAllPlansForAdmin,
  findSubscriptionByProviderId,
  createSubscriptionHistoryRecord,
} from "./billing.repository.js";
import {
  cancelImmediatelyService,
  scheduleCancellationService,
} from "./subscription.service.js";
import { getBillingProviderAdapter } from "./providers/billing-provider.factory.js";

/**
 * Helper to extract a single string from req.query (ParsedQs)
 */
const queryString = (val: unknown): string | undefined => {
  if (Array.isArray(val)) return typeof val[0] === "string" ? val[0] : undefined;
  if (typeof val === "string") return val;
  return undefined;
};

export const getBillingSummary = async (_req: Request, res: Response): Promise<void> => {
  const summary = await getBillingMetricsSummary();
  res.status(200).json({
    success: true,
    data: { summary },
  });
};

export const listAdminPlans = async (_req: Request, res: Response): Promise<void> => {
  const plans = await listAllPlansForAdmin();
  res.status(200).json({
    success: true,
    data: { plans },
  });
};

export const updateAdminPlan = async (req: Request, res: Response): Promise<void> => {
  const planId = String(req.params.planId);
  const { name, description, isActive, isPublic, displayOrder } = req.body;

  const plan = await prisma.plan.update({
    where: { id: planId },
    data: {
      ...(name ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(isPublic !== undefined ? { isPublic } : {}),
      ...(displayOrder !== undefined ? { displayOrder } : {}),
    },
    include: { prices: true, limits: true },
  });

  res.status(200).json({
    success: true,
    message: "Plan updated successfully",
    data: { plan },
  });
};

export const updateAdminPlanLimits = async (req: Request, res: Response): Promise<void> => {
  const planId = String(req.params.planId);
  const { limits } = req.body;

  for (const limitDef of limits) {
    await prisma.planLimit.upsert({
      where: {
        planId_metric: {
          planId,
          metric: limitDef.metric,
        },
      },
      update: {
        hardLimit: limitDef.hardLimit ?? null,
        softLimit: limitDef.softLimit ?? null,
        unlimited: limitDef.unlimited ?? false,
        resetInterval: limitDef.resetInterval ?? "monthly",
      },
      create: {
        planId,
        metric: limitDef.metric,
        hardLimit: limitDef.hardLimit ?? null,
        softLimit: limitDef.softLimit ?? null,
        unlimited: limitDef.unlimited ?? false,
        resetInterval: limitDef.resetInterval ?? "monthly",
      },
    });
  }

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
    include: { prices: true, limits: true },
  });

  res.status(200).json({
    success: true,
    message: "Plan limits updated successfully",
    data: { plan },
  });
};

export const listAdminSubscriptions = async (req: Request, res: Response): Promise<void> => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 20);
  const status = req.query.status as any;
  const planKey = queryString(req.query.planKey);
  const search = queryString(req.query.search);

  const result = await listAdminSubscriptionsRepo({
    page,
    pageSize,
    ...(status ? { status } : {}),
    ...(planKey ? { planKey } : {}),
    ...(search ? { search } : {}),
  });

  res.status(200).json({
    success: true,
    data: result,
  });
};

export const getAdminSubscriptionDetail = async (req: Request, res: Response): Promise<void> => {
  const subscriptionId = String(req.params.subscriptionId);
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    include: {
      user: { select: { id: true, email: true, fullName: true, role: true } },
      plan: { include: { limits: true, prices: true } },
      planPrice: true,
      history: { orderBy: { createdAt: "desc" }, take: 20 },
      invoices: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!subscription) {
    res.status(404).json({
      success: false,
      message: "Subscription was not found",
      error: { code: "SUBSCRIPTION_NOT_FOUND" },
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: { subscription },
  });
};

export const adminCancelSubscription = async (req: Request, res: Response): Promise<void> => {
  const subscriptionId = String(req.params.subscriptionId);
  const { reason, immediate } = req.body;
  const actorUserId = req.auth!.userId;

  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    res.status(404).json({
      success: false,
      message: "Subscription was not found",
      error: { code: "SUBSCRIPTION_NOT_FOUND" },
    });
    return;
  }

  const result = immediate
    ? await cancelImmediatelyService(subscription.userId, actorUserId, reason)
    : await scheduleCancellationService(subscription.userId, reason);

  res.status(200).json({
    success: true,
    message: immediate ? "Subscription canceled immediately" : "Subscription scheduled for cancellation",
    data: { subscription: result },
  });
};

export const synchronizeAdminSubscription = async (req: Request, res: Response): Promise<void> => {
  const subscriptionId = String(req.params.subscriptionId);
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription || !subscription.providerSubscriptionId) {
    res.status(400).json({
      success: false,
      message: "Subscription cannot be synchronized without a provider identifier",
      error: { code: "INVALID_SUBSCRIPTION" },
    });
    return;
  }

  const adapter = getBillingProviderAdapter(subscription.provider);
  const providerData = await adapter.retrieveSubscription(subscription.providerSubscriptionId);

  if (!providerData) {
    res.status(502).json({
      success: false,
      message: "Failed to retrieve subscription state from provider",
      error: { code: "PAYMENT_PROVIDER_ERROR" },
    });
    return;
  }

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: providerData.status as any,
      currentPeriodStart: providerData.currentPeriodStart,
      currentPeriodEnd: providerData.currentPeriodEnd,
      cancelAtPeriodEnd: providerData.cancelAtPeriodEnd,
    },
    include: { plan: true, planPrice: true },
  });

  res.status(200).json({
    success: true,
    message: "Subscription synchronized with provider",
    data: { subscription: updated },
  });
};

export const listWebhookEvents = async (req: Request, res: Response): Promise<void> => {
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 20);
  const status = req.query.status as any;

  const skip = (page - 1) * pageSize;
  const where = status ? { status } : {};

  const [events, totalItems] = await Promise.all([
    prisma.billingWebhookEvent.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      skip,
      take: pageSize,
    }),
    prisma.billingWebhookEvent.count({ where }),
  ]);

  res.status(200).json({
    success: true,
    data: { events, totalItems, page, pageSize },
  });
};
