import { prisma, disconnectDatabase } from "../infrastructure/database/prisma.js";

const checkDatabase = async (): Promise<void> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("Database connection check succeeded.");
  } catch {
    console.error("Database connection check failed.");
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
};

void checkDatabase();
