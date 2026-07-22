import { config } from "dotenv";
import { z } from "zod";

config({ path: new URL("../../../../.env", import.meta.url), quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_URL: z.url().min(1),
  REDIS_HOST: z.string().trim().min(1).default("localhost"),
  REDIS_PORT: z.coerce.number().int().positive().max(65_535).default(6_379),
  REDIS_USERNAME: z.string().trim().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().min(0).default(0),
  QUEUE_PREFIX: z.string().trim().min(1).default("lead-saas"),
  SCRAPING_QUEUE_NAME: z.string().trim().min(1).default("scraping-jobs"),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(2),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error("Invalid worker environment variables:");
  console.error(z.prettifyError(result.error));
  process.exit(1);
}

export const env = result.data;
