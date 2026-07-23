import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.middleware.js";
import { authorizeRoles } from "../../common/middleware/authorize.middleware.js";
import { validateBody } from "../../common/middleware/validate.middleware.js";
import {
  adminCancelSubscription,
  getAdminSubscriptionDetail,
  getBillingSummary,
  listAdminPlans,
  listAdminSubscriptions,
  listWebhookEvents,
  synchronizeAdminSubscription,
  updateAdminPlan,
  updateAdminPlanLimits,
} from "./admin-billing.controller.js";
import {
  adminCancelSubscriptionSchema,
  adminUpdatePlanLimitsSchema,
  adminUpdatePlanSchema,
} from "./billing.schemas.js";

export const adminBillingRouter = Router();

adminBillingRouter.use(authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"));

adminBillingRouter.get("/summary", getBillingSummary);

adminBillingRouter.get("/plans", listAdminPlans);
adminBillingRouter.patch("/plans/:planId", authorizeRoles("SUPER_ADMIN"), validateBody(adminUpdatePlanSchema), updateAdminPlan);
adminBillingRouter.patch("/plans/:planId/limits", authorizeRoles("SUPER_ADMIN"), validateBody(adminUpdatePlanLimitsSchema), updateAdminPlanLimits);

adminBillingRouter.get("/subscriptions", listAdminSubscriptions);
adminBillingRouter.get("/subscriptions/:subscriptionId", getAdminSubscriptionDetail);
adminBillingRouter.post("/subscriptions/:subscriptionId/cancel", validateBody(adminCancelSubscriptionSchema), adminCancelSubscription);
adminBillingRouter.post("/subscriptions/:subscriptionId/synchronize", synchronizeAdminSubscription);

adminBillingRouter.get("/webhook-events", listWebhookEvents);
