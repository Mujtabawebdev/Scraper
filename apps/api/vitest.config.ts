import { config as loadEnvironment } from "dotenv";
import { defineConfig } from "vitest/config";

import {
  deriveAuthTestDatabaseUrl,
  getDatabaseName,
} from "./test/prepare-auth-test-database.js";

loadEnvironment({ path: new URL("../../.env", import.meta.url), quiet: true });

const sourceDatabaseUrl = process.env.DATABASE_URL;
if (!sourceDatabaseUrl) {
  throw new Error("DATABASE_URL is required to configure authentication tests");
}

const testDatabaseUrl = deriveAuthTestDatabaseUrl(sourceDatabaseUrl);
if (!getDatabaseName(testDatabaseUrl).endsWith("_auth_test")) {
  throw new Error("Refusing to run authentication tests outside an auth-test database");
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["dist/**"],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    clearMocks: true,
    restoreMocks: true,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: testDatabaseUrl,
      DIRECT_DATABASE_URL: testDatabaseUrl,
      JWT_ACCESS_SECRET:
        "9ca7fae04e59469da839d409621203a3-auth-access-test-only",
      JWT_REFRESH_SECRET:
        "6873ceeb24c6484d9f93a23169b130f4-auth-refresh-test-only",
      JWT_ACCESS_EXPIRES_IN: "15m",
      JWT_REFRESH_EXPIRES_IN: "7d",
      AUTH_COOKIE_NAME: "lead_saas_refresh_token",
      AUTH_COOKIE_SECURE: "false",
      AUTH_COOKIE_SAME_SITE: "lax",
      AUTH_COOKIE_DOMAIN: "",
      AUTH_COOKIE_PATH: "/api/v1/auth",
      AUTH_LOGIN_RATE_LIMIT_WINDOW_MS: "900000",
      AUTH_LOGIN_RATE_LIMIT_MAX: "10000",
      AUTH_REGISTER_RATE_LIMIT_WINDOW_MS: "3600000",
      AUTH_REGISTER_RATE_LIMIT_MAX: "10000",
      AUTH_REFRESH_RATE_LIMIT_WINDOW_MS: "900000",
      AUTH_REFRESH_RATE_LIMIT_MAX: "10000",
      FRONTEND_URL: "http://localhost:5173",
      LOG_LEVEL: "silent",
    },
  },
});
