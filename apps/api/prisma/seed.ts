import { prisma, disconnectDatabase } from "../src/infrastructure/database/prisma.js";

const seed = async (): Promise<void> => {
  await prisma.user.upsert({
    where: { email: "system@lead-saas.local" },
    update: { fullName: "Lead SaaS System", role: "ADMIN", status: "ACTIVE" },
    create: {
      email: "system@lead-saas.local",
      fullName: "Lead SaaS System",
      passwordHash: "NON_LOGIN_SYSTEM_ACCOUNT",
      role: "ADMIN",
      status: "ACTIVE",
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
