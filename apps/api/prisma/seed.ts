import { prisma, disconnectDatabase } from "../src/infrastructure/database/prisma.js";

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
  console.log("Development system user is ready.");
};

try {
  await seed();
} catch {
  console.error("Database seed failed.");
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
