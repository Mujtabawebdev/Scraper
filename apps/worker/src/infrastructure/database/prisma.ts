import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@lead-saas/api/prisma-client";
import { Pool } from "pg";

import { env } from "../../config/env.js";

const databaseUrl = new URL(env.DATABASE_URL);
databaseUrl.searchParams.delete("schema");
if (databaseUrl.hostname === "localhost") databaseUrl.hostname = "127.0.0.1";

const pool = new Pool({ connectionString: databaseUrl.toString() });
const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
  await pool.end();
};
