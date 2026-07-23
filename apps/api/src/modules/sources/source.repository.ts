import { prisma } from "../../infrastructure/database/prisma.js";

export const listRealSourcePolicies = async () =>
  prisma.approvedSource.findMany({
    where: { sourceType: { not: "FIXTURE" } },
    orderBy: [{ displayName: "asc" }],
    select: {
      key: true,
      displayName: true,
      sourceType: true,
      status: true,
      isEnabled: true,
      requiresApiKey: true,
      allowsAutomatedAccess: true,
    },
  });
