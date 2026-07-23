import { rateLimit } from "express-rate-limit";
import type { Request, Response } from "express";

const createResourceRateLimiter = (
  windowMs: number,
  limit: number,
  resourceName: string,
) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    // These limiters are mounted after authenticate. A tenant key is stable
    // behind proxies and avoids grouping unrelated users by a shared IP.
    keyGenerator: (request: Request) => request.auth?.userId ?? "unauthenticated",
    handler: (_request: Request, response: Response) => {
      response.status(429).json({
        success: false,
        message: `Too many ${resourceName} requests; please try again later`,
        error: { code: "RATE_LIMIT_EXCEEDED" },
      });
    },
  });

export const jobCreationRateLimiter = createResourceRateLimiter(
  60 * 60 * 1_000,
  10,
  "job creation",
);

export const jobRetryRateLimiter = createResourceRateLimiter(
  60 * 60 * 1_000,
  20,
  "job retry",
);

export const leadExportRateLimiter = createResourceRateLimiter(
  15 * 60 * 1_000,
  10,
  "lead export",
);
