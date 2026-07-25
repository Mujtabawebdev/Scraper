import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createBaseEnv = () => ({
  NODE_ENV: "development",
  DATABASE_URL: "postgresql://postgres:admin@localhost:5432/us_business_leads?schema=public",
  DIRECT_DATABASE_URL: "postgresql://postgres:admin@localhost:5432/us_business_leads?schema=public",
  JWT_ACCESS_SECRET: "strong_access_secret_for_development_testing_key_12345",
  JWT_REFRESH_SECRET: "strong_refresh_secret_for_development_testing_key_67890",
});

describe("bootstrap admin environment validation", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, ...createBaseEnv() };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("allows the bootstrap admin to stay disabled with empty credentials", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as never);

    process.env = {
      ...process.env,
      BOOTSTRAP_ADMIN_ENABLED: "false",
      BOOTSTRAP_ADMIN_EMAIL: "",
      BOOTSTRAP_ADMIN_PASSWORD: "",
      BOOTSTRAP_ADMIN_FULL_NAME: "",
    };

    const { env } = await import("./env.js");

    expect(env.BOOTSTRAP_ADMIN_ENABLED).toBe(false);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("rejects bootstrap admin setup in production even when enabled", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
      throw new Error(`process.exit:${code ?? 0}`);
    }) as never);

    process.env = {
      ...process.env,
      NODE_ENV: "production",
      FRONTEND_URL: "https://leadsaas.example.com",
      AUTH_COOKIE_SECURE: "true",
      BOOTSTRAP_ADMIN_ENABLED: "true",
      BOOTSTRAP_ADMIN_EMAIL: "admin@example.com",
      BOOTSTRAP_ADMIN_PASSWORD: "StrongPassword123!",
      BOOTSTRAP_ADMIN_FULL_NAME: "Local Super Admin",
    };

    await expect(import("./env.js")).rejects.toThrow("process.exit:1");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
