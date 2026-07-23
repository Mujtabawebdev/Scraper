import pino from "pino";

import { env } from "../../config/env.js";

type SerializedHttpResponse = {
  statusCode: number | null;
};

export const serializeHttpResponseForLog = (
  response: SerializedHttpResponse,
): SerializedHttpResponse => ({
  statusCode: response.statusCode,
});

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: "lead-saas-api", environment: env.NODE_ENV },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers.set-cookie",
      "res.headers['set-cookie']",
      "req.body.password",
      "req.body.passwordHash",
      "req.body.accessToken",
      "req.body.refreshToken",
      "req.body.refreshTokenHash",
      "request.headers.authorization",
      "request.headers.cookie",
      "response.headers.set-cookie",
      "response.headers['set-cookie']",
      "request.body.password",
      "request.body.passwordHash",
      "request.body.accessToken",
      "request.body.refreshToken",
      "request.body.refreshTokenHash",
      "headers.authorization",
      "headers.cookie",
      "body.password",
      "body.passwordHash",
      "body.accessToken",
      "body.refreshToken",
      "body.refreshTokenHash",
      "password",
      "passwordHash",
      "accessToken",
      "refreshToken",
      "refreshTokenHash",
      "auth.password",
      "auth.passwordHash",
      "auth.accessToken",
      "auth.refreshToken",
      "auth.refreshTokenHash",
      "data.password",
      "data.passwordHash",
      "data.accessToken",
      "data.refreshToken",
      "data.refreshTokenHash",
      "user.passwordHash",
      "session.refreshTokenHash",
    ],
    censor: "[REDACTED]",
  },
});
