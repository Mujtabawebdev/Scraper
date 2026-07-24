import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: new URL("../../.env", import.meta.url), quiet: true });

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://lead_user:lead_password@postgres:5432/us_business_leads?schema=public";
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});




