import express, { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.middleware.js";
import { validateBody } from "../../common/middleware/validate.middleware.js";
import {
  cancelSubscription,
  changePlan,
  createCheckoutSession,
  createPortalSession,
  getSubscription,
  getUsage,
  listInvoices,
  listPayments,
  listPlans,
  resumeSubscription,
} from "./billing.controller.js";
import {
  cancelSubscriptionSchema,
  changePlanSchema,
  createCheckoutSessionSchema,
} from "./billing.schemas.js";
import { handleStripeWebhook } from "./billing.webhook.js";

export const billingRouter = Router();

// Stripe Webhook Endpoint (Must parse raw body for signature verification)
billingRouter.post(
  "/webhooks/stripe",
  express.raw({ type: "application/json" }),
  (req, _res, next) => {
    // Preserve rawBody if express.raw populated body as Buffer
    if (Buffer.isBuffer(req.body)) {
      (req as any).rawBody = req.body;
    }
    next();
  },
  handleStripeWebhook,
);

// Authenticated user billing routes
billingRouter.get("/plans", listPlans);
billingRouter.get("/subscription", authenticate, getSubscription);
billingRouter.get("/usage", authenticate, getUsage);
billingRouter.get("/invoices", authenticate, listInvoices);
billingRouter.get("/payments", authenticate, listPayments);

billingRouter.post("/checkout-session", authenticate, validateBody(createCheckoutSessionSchema), createCheckoutSession);
billingRouter.post("/portal-session", authenticate, createPortalSession);
billingRouter.post("/change-plan", authenticate, validateBody(changePlanSchema), changePlan);
billingRouter.post("/cancel", authenticate, validateBody(cancelSubscriptionSchema), cancelSubscription);
billingRouter.post("/resume", authenticate, resumeSubscription);
