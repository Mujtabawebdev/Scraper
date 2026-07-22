import pino from "pino";

import { env } from "../../config/env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "lead-saas-worker", environment: env.NODE_ENV },
  redact: {
    paths: ["password", "accessToken", "refreshToken", "redisPassword", "databaseUrl"],
    censor: "[REDACTED]",
  },
});
