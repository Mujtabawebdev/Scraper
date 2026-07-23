import { config } from "dotenv";
import { z } from "zod";

config({ path: new URL("../../../../.env", import.meta.url), quiet: true });

const optionalSecretSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).optional(),
);

const optionalUrlSchema = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() === "" ? undefined : value,
  z.url().optional(),
);

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
  CSV_IMPORT_QUEUE_NAME: z.string().trim().min(1).default("csv-imports"),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(20).default(2),
  SCRAPING_FIXTURE_SOURCE_ENABLED: z.stringbool().default(false),
  SCRAPING_EXTERNAL_SOURCE_ENABLED: z.stringbool().default(false),
  SCRAPING_APPROVED_BASE_URL: z.string().trim().optional(),
  SCRAPING_USER_AGENT: z.string().trim().min(1).default("LeadSaaSResearchBot/0.1"),
  SCRAPING_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
  SCRAPING_MIN_DELAY_MS: z.coerce.number().int().min(1_500).max(60_000).default(1_500),
  SCRAPING_MAX_PAGES_PER_JOB: z.coerce.number().int().min(1).max(5).default(5),
  GOOGLE_PLACES_API_KEY: optionalSecretSchema,
  GOOGLE_PLACES_REGION: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .transform((value) => value.toUpperCase())
    .default("US"),
  GOOGLE_PLACES_LANGUAGE: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/)
    .default("en"),
  GOOGLE_PLACES_REQUEST_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(1_000)
    .max(60_000)
    .default(15_000),
  GOOGLE_PLACES_MAX_PAGES_PER_JOB: z.coerce
    .number()
    .int()
    .min(1)
    .max(3)
    .default(1),
  GOOGLE_PLACES_DEFAULT_RADIUS_METERS: z.coerce
    .number()
    .int()
    .min(100)
    .max(50_000)
    .default(25_000),
  META_APPROVED_API_ACCESS_TOKEN: optionalSecretSchema,
  YELP_APPROVED_API_KEY: optionalSecretSchema,
  GOVERNMENT_DATASET_URL: optionalUrlSchema,
  WEBSITE_ENRICHMENT_MAX_PAGES: z.coerce
    .number()
    .int()
    .min(1)
    .max(10)
    .default(5),
  WEBSITE_ENRICHMENT_MAX_DEPTH: z.coerce
    .number()
    .int()
    .min(0)
    .max(2)
    .default(1),
  WEBSITE_ENRICHMENT_MAX_RESPONSE_BYTES: z.coerce
    .number()
    .int()
    .min(64 * 1_024)
    .max(5 * 1_024 * 1_024)
    .default(2 * 1_024 * 1_024),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error("Invalid worker environment variables:");
  console.error(z.prettifyError(result.error));
  process.exit(1);
}

export const env = result.data;
