import { describe, expect, it } from "vitest";
import { z } from "zod";

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

const optionalSecretSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().min(1).optional(),
);

const rateLimitWindowSchema = z.coerce.number().int().positive().max(604_800_000);
const rateLimitMaximumSchema = z.coerce.number().int().positive().max(10_000);
const insecureSecretPattern = /(?:replace[_-]?with|placeholder|change[_-]?me|development|example|insecure)/i;

const testEnvSchema = z
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
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: jwtDurationSchema.default("15m"),
    JWT_REFRESH_EXPIRES_IN: jwtDurationSchema.default("7d"),
    AUTH_COOKIE_NAME: z.string().trim().min(1).default("lead_saas_refresh_token"),
    AUTH_COOKIE_SECURE: z.stringbool().default(false),
    AUTH_COOKIE_SAME_SITE: z.enum(["lax", "strict", "none"]).default("lax"),
    AUTH_COOKIE_PATH: z.string().trim().startsWith("/").default("/api/v1/auth"),
    METRICS_BEARER_TOKEN: optionalSecretSchema,
  })
  .superRefine((values, context) => {
    const accessDurationSeconds = durationToSeconds(values.JWT_ACCESS_EXPIRES_IN);
    const refreshDurationSeconds = durationToSeconds(values.JWT_REFRESH_EXPIRES_IN);

    if (values.JWT_ACCESS_SECRET === values.JWT_REFRESH_SECRET) {
      context.addIssue({
        code: "custom",
        path: ["JWT_REFRESH_SECRET"],
        message: "Access and refresh token secrets must be different",
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

const validDevEnv = {
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://postgres:admin@localhost:5432/us_business_leads?schema=public",
  DIRECT_DATABASE_URL: "postgresql://postgres:admin@localhost:5432/us_business_leads?schema=public",
  JWT_ACCESS_SECRET: "strong_access_secret_for_development_testing_key_12345",
  JWT_REFRESH_SECRET: "strong_refresh_secret_for_development_testing_key_67890",
};

describe("Production Environment Hardening Schema", () => {
  it("validates a healthy development environment", () => {
    const result = testEnvSchema.safeParse(validDevEnv);
    expect(result.success).toBe(true);
  });

  it("rejects identical access and refresh secrets", () => {
    const result = testEnvSchema.safeParse({
      ...validDevEnv,
      JWT_ACCESS_SECRET: "same_secret_key_used_for_both_tokens_1234567890",
      JWT_REFRESH_SECRET: "same_secret_key_used_for_both_tokens_1234567890",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("JWT_REFRESH_SECRET"));
      expect(issue).toBeDefined();
    }
  });

  it("rejects non-secure auth cookies in production mode", () => {
    const result = testEnvSchema.safeParse({
      ...validDevEnv,
      NODE_ENV: "production",
      FRONTEND_URL: "https://leadsaas.example.com",
      AUTH_COOKIE_SECURE: "false",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("AUTH_COOKIE_SECURE"));
      expect(issue?.message).toContain("Secure authentication cookies are required in production");
    }
  });

  it("rejects localhost FRONTEND_URL in production mode", () => {
    const result = testEnvSchema.safeParse({
      ...validDevEnv,
      NODE_ENV: "production",
      FRONTEND_URL: "http://localhost:5173",
      AUTH_COOKIE_SECURE: "true",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("FRONTEND_URL"));
      expect(issue?.message).toContain("Localhost or wildcard FRONTEND_URL is not allowed in production");
    }
  });

  it("rejects placeholder JWT secrets in production mode", () => {
    const result = testEnvSchema.safeParse({
      ...validDevEnv,
      NODE_ENV: "production",
      FRONTEND_URL: "https://leadsaas.example.com",
      AUTH_COOKIE_SECURE: "true",
      JWT_ACCESS_SECRET: "replace_with_secure_access_secret_key_12345",
      JWT_REFRESH_SECRET: "strong_production_refresh_secret_key_6789012",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((i) => i.path.includes("JWT_ACCESS_SECRET"));
      expect(issue?.message).toContain("Placeholder JWT secrets are not allowed in production");
    }
  });

  it("accepts valid hardened production settings", () => {
    const result = testEnvSchema.safeParse({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://prod_user:secret@postgres:5432/us_business_leads?schema=public",
      DIRECT_DATABASE_URL: "postgresql://prod_user:secret@postgres:5432/us_business_leads?schema=public",
      FRONTEND_URL: "https://leadsaas.example.com",
      AUTH_COOKIE_SECURE: "true",
      JWT_ACCESS_SECRET: "super_strong_production_access_key_9876543210",
      JWT_REFRESH_SECRET: "super_strong_production_refresh_key_1234567890",
    });
    expect(result.success).toBe(true);
  });
});
