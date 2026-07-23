import { prisma } from "../../../infrastructure/database/prisma.js";
import { env } from "../../../config/env.js";

export type PlanDefinition = {
  key: string;
  name: string;
  description: string;
  isPublic: boolean;
  displayOrder: number;
  prices: Array<{
    billingInterval: "MONTHLY" | "YEARLY";
    currency: string;
    unitAmount: number;
    providerPriceId?: string | null;
  }>;
  limits: Array<{
    metric:
      | "SCRAPING_JOBS"
      | "REQUESTED_LEADS"
      | "STORED_LEADS"
      | "CSV_EXPORTS"
      | "EXPORTED_LEADS"
      | "API_REQUESTS"
      | "WEBSITE_ENRICHMENTS"
      | "PHONE_ENRICHMENTS"
      | "TEAM_MEMBERS";
    hardLimit?: number | null;
    softLimit?: number | null;
    unlimited?: boolean;
    resetInterval?: string;
  }>;
};

export const DEFAULT_PLANS: readonly PlanDefinition[] = [
  {
    key: "FREE",
    name: "Free",
    description: "Ideal for trying out business lead scraping and verification.",
    isPublic: true,
    displayOrder: 1,
    prices: [
      {
        billingInterval: "MONTHLY",
        currency: "usd",
        unitAmount: 0,
      },
      {
        billingInterval: "YEARLY",
        currency: "usd",
        unitAmount: 0,
      },
    ],
    limits: [
      { metric: "SCRAPING_JOBS", hardLimit: 5, softLimit: 4, unlimited: false },
      { metric: "REQUESTED_LEADS", hardLimit: 250, softLimit: 200, unlimited: false },
      { metric: "CSV_EXPORTS", hardLimit: 2, softLimit: 2, unlimited: false },
      { metric: "EXPORTED_LEADS", hardLimit: 250, softLimit: 200, unlimited: false },
      { metric: "WEBSITE_ENRICHMENTS", hardLimit: 100, softLimit: 80, unlimited: false },
      { metric: "PHONE_ENRICHMENTS", hardLimit: 100, softLimit: 80, unlimited: false },
      { metric: "TEAM_MEMBERS", hardLimit: 1, softLimit: 1, unlimited: false },
    ],
  },
  {
    key: "STARTER",
    name: "Starter",
    description: "Designed for small sales teams and growing lead generation operations.",
    isPublic: true,
    displayOrder: 2,
    prices: [
      {
        billingInterval: "MONTHLY",
        currency: "usd",
        unitAmount: 2900,
        providerPriceId: env.STRIPE_PRICE_STARTER_MONTHLY ?? null,
      },
      {
        billingInterval: "YEARLY",
        currency: "usd",
        unitAmount: 29000,
        providerPriceId: env.STRIPE_PRICE_STARTER_YEARLY ?? null,
      },
    ],
    limits: [
      { metric: "SCRAPING_JOBS", hardLimit: 50, softLimit: 40, unlimited: false },
      { metric: "REQUESTED_LEADS", hardLimit: 5000, softLimit: 4500, unlimited: false },
      { metric: "CSV_EXPORTS", hardLimit: 25, softLimit: 20, unlimited: false },
      { metric: "EXPORTED_LEADS", hardLimit: 5000, softLimit: 4500, unlimited: false },
      { metric: "WEBSITE_ENRICHMENTS", hardLimit: 2500, softLimit: 2000, unlimited: false },
      { metric: "PHONE_ENRICHMENTS", hardLimit: 2500, softLimit: 2000, unlimited: false },
      { metric: "TEAM_MEMBERS", hardLimit: 1, softLimit: 1, unlimited: false },
    ],
  },
  {
    key: "PRO",
    name: "Pro",
    description: "High-volume extraction, enrichment, and deduplication for agencies.",
    isPublic: true,
    displayOrder: 3,
    prices: [
      {
        billingInterval: "MONTHLY",
        currency: "usd",
        unitAmount: 7900,
        providerPriceId: env.STRIPE_PRICE_PRO_MONTHLY ?? null,
      },
      {
        billingInterval: "YEARLY",
        currency: "usd",
        unitAmount: 79000,
        providerPriceId: env.STRIPE_PRICE_PRO_YEARLY ?? null,
      },
    ],
    limits: [
      { metric: "SCRAPING_JOBS", hardLimit: 250, softLimit: 220, unlimited: false },
      { metric: "REQUESTED_LEADS", hardLimit: 25000, softLimit: 22500, unlimited: false },
      { metric: "CSV_EXPORTS", hardLimit: 150, softLimit: 130, unlimited: false },
      { metric: "EXPORTED_LEADS", hardLimit: 25000, softLimit: 22500, unlimited: false },
      { metric: "WEBSITE_ENRICHMENTS", hardLimit: 15000, softLimit: 13500, unlimited: false },
      { metric: "PHONE_ENRICHMENTS", hardLimit: 15000, softLimit: 13500, unlimited: false },
      { metric: "TEAM_MEMBERS", hardLimit: 5, softLimit: 5, unlimited: false },
    ],
  },
  {
    key: "ENTERPRISE",
    name: "Enterprise",
    description: "Custom scale, dedicated compliance controls, and flexible limits.",
    isPublic: false,
    displayOrder: 4,
    prices: [
      {
        billingInterval: "MONTHLY",
        currency: "usd",
        unitAmount: 29900,
      },
      {
        billingInterval: "YEARLY",
        currency: "usd",
        unitAmount: 299000,
      },
    ],
    limits: [
      { metric: "SCRAPING_JOBS", unlimited: true },
      { metric: "REQUESTED_LEADS", unlimited: true },
      { metric: "CSV_EXPORTS", unlimited: true },
      { metric: "EXPORTED_LEADS", unlimited: true },
      { metric: "WEBSITE_ENRICHMENTS", unlimited: true },
      { metric: "PHONE_ENRICHMENTS", unlimited: true },
      { metric: "TEAM_MEMBERS", hardLimit: 25, softLimit: 20, unlimited: false },
    ],
  },
];

export const seedPlanCatalog = async (): Promise<void> => {
  for (const planDef of DEFAULT_PLANS) {
    const plan = await prisma.plan.upsert({
      where: { key: planDef.key },
      update: {
        name: planDef.name,
        description: planDef.description,
        isPublic: planDef.isPublic,
        displayOrder: planDef.displayOrder,
      },
      create: {
        key: planDef.key,
        name: planDef.name,
        description: planDef.description,
        isPublic: planDef.isPublic,
        displayOrder: planDef.displayOrder,
        billingProvider: env.BILLING_PROVIDER,
      },
    });

    for (const priceDef of planDef.prices) {
      await prisma.planPrice.upsert({
        where: {
          planId_billingInterval_currency: {
            planId: plan.id,
            billingInterval: priceDef.billingInterval,
            currency: priceDef.currency,
          },
        },
        update: {
          unitAmount: priceDef.unitAmount,
          ...(priceDef.providerPriceId ? { providerPriceId: priceDef.providerPriceId } : {}),
        },
        create: {
          planId: plan.id,
          billingInterval: priceDef.billingInterval,
          currency: priceDef.currency,
          unitAmount: priceDef.unitAmount,
          providerPriceId: priceDef.providerPriceId ?? null,
        },
      });
    }

    for (const limitDef of planDef.limits) {
      await prisma.planLimit.upsert({
        where: {
          planId_metric: {
            planId: plan.id,
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
          planId: plan.id,
          metric: limitDef.metric,
          hardLimit: limitDef.hardLimit ?? null,
          softLimit: limitDef.softLimit ?? null,
          unlimited: limitDef.unlimited ?? false,
          resetInterval: limitDef.resetInterval ?? "monthly",
        },
      });
    }
  }
};
