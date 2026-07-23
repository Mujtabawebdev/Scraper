import { z } from "zod";

export const billingIntervalEnum = z.enum(["MONTHLY", "YEARLY", "CUSTOM"]);

export const usageMetricEnum = z.enum([
  "SCRAPING_JOBS",
  "REQUESTED_LEADS",
  "STORED_LEADS",
  "CSV_EXPORTS",
  "EXPORTED_LEADS",
  "API_REQUESTS",
  "WEBSITE_ENRICHMENTS",
  "PHONE_ENRICHMENTS",
  "TEAM_MEMBERS",
]);

export const createCheckoutSessionSchema = z.object({
  planKey: z.string().trim().min(1).max(50),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
  idempotencyKey: z.string().trim().max(255).optional(),
});

export const changePlanSchema = z.object({
  targetPlanKey: z.string().trim().min(1).max(50),
  billingInterval: z.enum(["MONTHLY", "YEARLY"]).default("MONTHLY"),
});

export const cancelSubscriptionSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const adminUpdatePlanSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

export const adminUpdatePlanLimitsSchema = z.object({
  limits: z.array(
    z.object({
      metric: usageMetricEnum,
      hardLimit: z.number().int().min(0).nullable().optional(),
      softLimit: z.number().int().min(0).nullable().optional(),
      unlimited: z.boolean().optional(),
      resetInterval: z.string().trim().max(20).optional(),
    }),
  ),
});

export const adminCancelSubscriptionSchema = z.object({
  reason: z.string().trim().max(500).optional(),
  immediate: z.boolean().default(false),
});
