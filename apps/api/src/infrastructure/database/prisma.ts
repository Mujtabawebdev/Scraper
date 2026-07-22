import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

import { env } from "../../config/env.js";
import { PrismaClient } from "../../generated/prisma/client.js";

type DatabaseGlobals = {
  pool?: Pool;
  prisma?: PrismaClient;
};

const databaseGlobals = globalThis as typeof globalThis & DatabaseGlobals;
const databaseUrl = new URL(env.DATABASE_URL);

databaseUrl.searchParams.delete("schema");
if (databaseUrl.hostname === "localhost") {
  databaseUrl.hostname = "127.0.0.1";
}

const pool = databaseGlobals.pool ?? new Pool({ connectionString: databaseUrl.toString() });
const adapter = new PrismaPg(pool);

export const prisma = databaseGlobals.prisma ?? new PrismaClient({ adapter });

if (env.NODE_ENV !== "production") {
  databaseGlobals.pool = pool;
  databaseGlobals.prisma = prisma;
}

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
  await pool.end();
};
