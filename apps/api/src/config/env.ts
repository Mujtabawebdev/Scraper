import { config } from "dotenv";
import { z } from "zod";

config({ path: new URL("../../../../.env", import.meta.url), quiet: true });

const jwtDurationSchema = z
  .string()
  .trim()
  .regex(/^[1-9]\d*(?:s|m|h|d)$/, "Must be a positive duration such as 15m or 7d");

const durationToSeconds = (duration: string): number => {
  const match = /^([1-9]\d*)([smhd])$/.exec(duration);
  if (!match?.[1] || !match[2]) {
    return Number.NaN;
  }
  const multiplier = { s: 1, m: 60, h: 3_600, d: 86_400 }[match[2] as "s" | "m" | "h" | "d"];
  return Number(match[1]) * multiplier;
};

const optionalCookieDomainSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z
    .string()
    .trim()
    .min(1)
    .max(253)
    .regex(
      /^\.?(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)*[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/,
      "Must be a valid cookie domain",
    )
    .optional(),
);

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

const rateLimitWindowSchema = z.coerce
  .number()
  .int()
  .positive()
  .max(604_800_000);

const rateLimitMaximumSchema = z.coerce.number().int().positive().max(10_000);

const insecureSecretPattern =
  /(?:replace[_-]?with|placeholder|change[_-]?me|development|example|insecure)/i;

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    API_PORT: z.coerce.number().int().positive().max(65_535).default(5_000),
    FRONTEND_URL: z.url().default("http://localhost:5173"),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    DATABASE_URL: z.url().min(1),
    DIRECT_DATABASE_URL: z.url().min(1),
    REDIS_HOST: z.string().trim().min(1).default("localhost"),
    REDIS_PORT: z.coerce.number().int().positive().max(65_535).default(6_379),
    REDIS_USERNAME: z.string().trim().optional(),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_DB: z.coerce.number().int().min(0).default(0),
    REDIS_MAX_RETRIES_PER_REQUEST: z.preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      z.coerce.number().int().min(0).default(1),
    ),
    QUEUE_PREFIX: z.string().trim().min(1).default("lead-saas"),
    SCRAPING_QUEUE_NAME: z.string().trim().min(1).default("scraping-jobs"),
    CSV_IMPORT_QUEUE_NAME: z.string().trim().min(1).default("csv-imports"),
    SCRAPING_FIXTURE_SOURCE_ENABLED: z.stringbool().default(false),
    SCRAPING_EXTERNAL_SOURCE_ENABLED: z.stringbool().default(false),
    SCRAPING_APPROVED_BASE_URL: z.string().trim().optional(),
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
    CSV_IMPORT_MAX_FILE_BYTES: z.coerce
      .number()
      .int()
      .min(1_024)
      .max(10 * 1_024 * 1_024)
      .default(5 * 1_024 * 1_024),
    CSV_IMPORT_MAX_ROWS: z.coerce
      .number()
      .int()
      .min(1)
      .max(50_000)
      .default(10_000),
    CSV_IMPORT_BACKGROUND_THRESHOLD_ROWS: z.coerce
      .number()
      .int()
      .min(1)
      .max(50_000)
      .default(500),
    CSV_IMPORT_RATE_LIMIT_WINDOW_MS: rateLimitWindowSchema.default(3_600_000),
    CSV_IMPORT_RATE_LIMIT_MAX: rateLimitMaximumSchema.default(10),
    LEAD_VERIFY_RATE_LIMIT_WINDOW_MS: rateLimitWindowSchema.default(900_000),
    LEAD_VERIFY_RATE_LIMIT_MAX: rateLimitMaximumSchema.default(20),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: jwtDurationSchema.default("15m"),
    JWT_REFRESH_EXPIRES_IN: jwtDurationSchema.default("7d"),
    AUTH_COOKIE_NAME: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^[A-Za-z0-9._-]+$/, "Must be a valid cookie name")
      .default("lead_saas_refresh_token"),
    AUTH_COOKIE_SECURE: z.stringbool().default(false),
    AUTH_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
    AUTH_COOKIE_DOMAIN: optionalCookieDomainSchema,
    AUTH_COOKIE_PATH: z.string().trim().startsWith("/").max(255).default("/api/v1/auth"),
    AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: rateLimitWindowSchema.default(900_000),
    AUTH_LOGIN_RATE_LIMIT_MAX: rateLimitMaximumSchema.default(10),
    AUTH_REGISTER_RATE_LIMIT_WINDOW_MS: rateLimitWindowSchema.default(3_600_000),
    AUTH_REGISTER_RATE_LIMIT_MAX: rateLimitMaximumSchema.default(5),
    AUTH_REFRESH_RATE_LIMIT_WINDOW_MS: rateLimitWindowSchema.default(900_000),
    AUTH_REFRESH_RATE_LIMIT_MAX: rateLimitMaximumSchema.default(30),
    BILLING_PROVIDER: z.enum(["STRIPE", "MANUAL", "NONE"]).default("NONE"),
    STRIPE_SECRET_KEY: optionalSecretSchema,
    STRIPE_WEBHOOK_SECRET: optionalSecretSchema,
    STRIPE_PUBLISHABLE_KEY: optionalSecretSchema,
    STRIPE_PRICE_STARTER_MONTHLY: optionalSecretSchema,
    STRIPE_PRICE_PRO_MONTHLY: optionalSecretSchema,
    STRIPE_PRICE_STARTER_YEARLY: optionalSecretSchema,
    STRIPE_PRICE_PRO_YEARLY: optionalSecretSchema,
    BILLING_SUCCESS_URL: z.url().default("http://localhost:5173/billing?checkout=success"),
    BILLING_CANCEL_URL: z.url().default("http://localhost:5173/billing?checkout=cancelled"),
    BILLING_PORTAL_RETURN_URL: z.url().default("http://localhost:5173/billing"),
    METRICS_BEARER_TOKEN: optionalSecretSchema,
  })
  .superRefine((values, context) => {
    const accessDurationSeconds = durationToSeconds(values.JWT_ACCESS_EXPIRES_IN);
    const refreshDurationSeconds = durationToSeconds(values.JWT_REFRESH_EXPIRES_IN);

    if (!Number.isSafeInteger(accessDurationSeconds) || accessDurationSeconds > 3_600) {
      context.addIssue({
        code: "custom",
        path: ["JWT_ACCESS_EXPIRES_IN"],
        message: "Access token duration must not exceed 1 hour",
      });
    }
    if (
      !Number.isSafeInteger(refreshDurationSeconds) ||
      refreshDurationSeconds > 90 * 86_400
    ) {
      context.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_EXPIRES_IN"],
        message: "Refresh token duration must not exceed 90 days",
      });
    }
    if (
      Number.isSafeInteger(accessDurationSeconds) &&
      Number.isSafeInteger(refreshDurationSeconds) &&
      accessDurationSeconds >= refreshDurationSeconds
    ) {
      context.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_EXPIRES_IN"],
        message: "Refresh token duration must be longer than access token duration",
      });
    }

    if (values.JWT_ACCESS_SECRET === values.JWT_REFRESH_SECRET) {
      context.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_SECRET"],
        message: "Access and refresh token secrets must be different",
      });
    }

    if (values.AUTH_COOKIE_SAME_SITE === "none" && !values.AUTH_COOKIE_SECURE) {
      context.addIssue({
        code: "custom",
        path: ["AUTH_COOKIE_SECURE"],
        message: "Secure cookies are required when SameSite is none",
      });
    }

    if (
      values.CSV_IMPORT_BACKGROUND_THRESHOLD_ROWS >
      values.CSV_IMPORT_MAX_ROWS
    ) {
      context.addIssue({
        code: "custom",
        path: ["CSV_IMPORT_BACKGROUND_THRESHOLD_ROWS"],
        message: "Background threshold must not exceed the CSV row limit",
      });
    }

    if (values.NODE_ENV === "production") {
      if (!values.AUTH_COOKIE_SECURE) {
        context.addIssue({
          code: "custom",
          path: ["AUTH_COOKIE_SECURE"],
          message: "Secure authentication cookies are required in production",
        });
      }

      if (values.FRONTEND_URL.includes("localhost") || values.FRONTEND_URL.includes("*")) {
        context.addIssue({
          code: "custom",
          path: ["FRONTEND_URL"],
          message: "Localhost or wildcard FRONTEND_URL is not allowed in production",
        });
      }

      for (const [path, secret] of [
        ["JWT_ACCESS_SECRET", values.JWT_ACCESS_SECRET],
        ["JWT_REFRESH_SECRET", values.JWT_REFRESH_SECRET],
      ] as const) {
        if (insecureSecretPattern.test(secret)) {
          context.addIssue({
            code: "custom",
            path: [path],
            message: "Placeholder JWT secrets are not allowed in production",
          });
        }
      }
    }
  });

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Invalid environment variables:");
  console.error(z.prettifyError(result.error));
  process.exit(1);
}

export const env = result.data;
