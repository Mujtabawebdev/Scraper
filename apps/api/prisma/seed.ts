import { prisma, disconnectDatabase } from "../src/infrastructure/database/prisma.js";
import { seedPlanCatalog } from "../src/modules/billing/plans/plan-catalog.js";

const SYSTEM_ACCOUNT_PASSWORD_HASH = "NON_LOGIN_SYSTEM_ACCOUNT";

const seed = async (): Promise<void> => {
  await prisma.user.upsert({
    where: { email: "system@lead-saas.local" },
    update: {
      fullName: "Lead SaaS System",
      passwordHash: SYSTEM_ACCOUNT_PASSWORD_HASH,
      role: "ADMIN",
      status: "DISABLED",
    },
    create: {
      email: "system@lead-saas.local",
      fullName: "Lead SaaS System",
      passwordHash: SYSTEM_ACCOUNT_PASSWORD_HASH,
      role: "ADMIN",
      status: "DISABLED",
    },
  });
  console.log(
    "Disabled non-login system user is ready; promote a real registered user through a controlled database operation for the first SUPER_ADMIN.",
  );

  await seedPlanCatalog();
  console.log("Subscription plans, prices, and default limits catalog seeded successfully.");
};

try {
  await seed();
} catch (err: unknown) {
  console.error("Database seed failed:", err);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
