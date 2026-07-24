import { rateLimit } from "express-rate-limit";
import type { Request, Response } from "express";

export const globalApiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1_000, // 15 minutes
  limit: 200, // 200 requests per 15 min per IP/user
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (request: Request) => request.auth?.userId ?? request.ip ?? "anonymous",
  handler: (_request: Request, response: Response) => {
    response.status(429).json({
      success: false,
      message: "Too many requests from this client; please try again later",
      error: { code: "GLOBAL_RATE_LIMIT_EXCEEDED" },
    });
  },
});
