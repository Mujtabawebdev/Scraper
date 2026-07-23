import type { Request, Response } from "express";
import { listPublicPlans } from "./billing.repository.js";
import { getEntitlementsForUser } from "./entitlement.service.js";
import {
  cancelImmediatelyService,
  createBillingPortalSessionService,
  createCheckoutSessionService,
  downgradeSubscriptionService,
  getCurrentSubscriptionService,
  getUserInvoicesService,
  getUserPaymentsService,
  resumeSubscriptionService,
  scheduleCancellationService,
  upgradeSubscriptionService,
} from "./subscription.service.js";

export const listPlans = async (_req: Request, res: Response): Promise<void> => {
  const plans = await listPublicPlans();
  res.status(200).json({
    success: true,
    data: { plans },
  });
};

export const getSubscription = async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const subscription = await getCurrentSubscriptionService(userId);
  res.status(200).json({
    success: true,
    data: { subscription },
  });
};

export const getUsage = async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const usage = await getEntitlementsForUser(userId);
  res.status(200).json({
    success: true,
    data: { usage },
  });
};

export const listInvoices = async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 20);

  const result = await getUserInvoicesService(userId, page, pageSize);
  res.status(200).json({
    success: true,
    data: result,
  });
};

export const listPayments = async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const page = Number(req.query.page ?? 1);
  const pageSize = Number(req.query.pageSize ?? 20);

  const result = await getUserPaymentsService(userId, page, pageSize);
  res.status(200).json({
    success: true,
    data: result,
  });
};

export const createCheckoutSession = async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const session = await createCheckoutSessionService(userId, req.body);
  res.status(200).json({
    success: true,
    data: session,
  });
};

export const createPortalSession = async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const session = await createBillingPortalSessionService(userId);
  res.status(200).json({
    success: true,
    data: session,
  });
};

export const changePlan = async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const { targetPlanKey, billingInterval } = req.body;

  const currentSub = await getCurrentSubscriptionService(userId);
  const isUpgrade = targetPlanKey === "PRO" || (targetPlanKey === "STARTER" && currentSub.plan.key === "FREE");

  const subscription = isUpgrade
    ? await upgradeSubscriptionService(userId, targetPlanKey, billingInterval)
    : await downgradeSubscriptionService(userId, targetPlanKey);

  res.status(200).json({
    success: true,
    message: `Subscription plan updated to ${targetPlanKey}`,
    data: { subscription },
  });
};

export const cancelSubscription = async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const subscription = await scheduleCancellationService(userId, req.body?.reason);
  res.status(200).json({
    success: true,
    message: "Subscription scheduled for cancellation at end of period",
    data: { subscription },
  });
};

export const resumeSubscription = async (req: Request, res: Response): Promise<void> => {
  const userId = req.auth!.userId;
  const subscription = await resumeSubscriptionService(userId);
  res.status(200).json({
    success: true,
    message: "Subscription cancellation revoked",
    data: { subscription },
  });
};
