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
  SCRAPING_FIXTURE_SOURCE_ENABLED: z.stringbool().default(false),
  SCRAPING_EXTERNAL_SOURCE_ENABLED: z.stringbool().default(false),
  SCRAPING_APPROVED_BASE_URL: z.string().trim().optional(),
  SCRAPING_USER_AGENT: z.string().trim().min(1).default("LeadSaaSResearchBot/0.1"),
  SCRAPING_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
  SCRAPING_MIN_DELAY_MS: z.coerce.number().int().min(1_500).max(60_000).default(1_500),
  SCRAPING_MAX_PAGES_PER_JOB: z.coerce.number().int().min(1).max(5).default(5),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error("Invalid worker environment variables:");
  console.error(z.prettifyError(result.error));
  process.exit(1);
}

export const env = result.data;
