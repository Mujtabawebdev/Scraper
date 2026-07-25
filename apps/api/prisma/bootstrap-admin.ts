import { logger } from "../src/common/logger/logger.js";
import { env } from "../src/config/env.js";
import { registerSchema } from "../src/modules/auth/auth.schemas.js";
import { hashPassword } from "../src/modules/auth/password.service.js";
import { prisma, disconnectDatabase } from "../src/infrastructure/database/prisma.js";

const bootstrapAdmin = async (): Promise<void> => {
  if (!env.BOOTSTRAP_ADMIN_ENABLED) {
    logger.info("Bootstrap admin disabled; no action taken");
    return;
  }

  if (env.NODE_ENV !== "development") {
    throw new Error("Bootstrap admin is only supported in development");
  }

  const parsedBootstrapInput = registerSchema.parse({
    fullName: env.BOOTSTRAP_ADMIN_FULL_NAME,
    email: env.BOOTSTRAP_ADMIN_EMAIL,
    password: env.BOOTSTRAP_ADMIN_PASSWORD,
  });

  const normalizedEmail = parsedBootstrapInput.email;
  const normalizedFullName = parsedBootstrapInput.fullName;
  const password = parsedBootstrapInput.password;

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, passwordHash: true },
  });

  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        fullName: normalizedFullName,
        role: "SUPER_ADMIN",
        status: "ACTIVE",
      },
    });

    logger.info({ email: normalizedEmail }, "Bootstrap admin promoted to SUPER_ADMIN");
    return;
  }

  const passwordHash = await hashPassword(password);

  await prisma.user.create({
    data: {
      email: normalizedEmail,
      fullName: normalizedFullName,
      passwordHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });

  logger.info({ email: normalizedEmail }, "Bootstrap admin created");
};

try {
  await bootstrapAdmin();
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown bootstrap failure";
  logger.error({ err: error }, "Bootstrap admin failed");
  console.error(`Bootstrap admin failed: ${message}`);
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
