import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { errorHandler } from "./common/middleware/error.middleware.js";
import { globalApiRateLimiter } from "./common/middleware/global-rate-limit.middleware.js";
import { requestContextMiddleware } from "./common/middleware/request-context.middleware.js";
import { securityHeadersMiddleware } from "./common/middleware/security-headers.middleware.js";
import { logger, serializeHttpResponseForLog } from "./common/logger/logger.js";
import { env } from "./config/env.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { scrapingJobRouter } from "./modules/scraping-jobs/scraping-job.routes.js";
import { leadRouter } from "./modules/leads/lead.routes.js";
import { sourceRouter } from "./modules/sources/source.routes.js";
import { csvImportRouter } from "./modules/imports/csv-import.routes.js";
import { adminQualityRouter, leadQualityRouter } from "./modules/lead-quality/lead-quality.routes.js";
import { billingRouter } from "./modules/billing/billing.routes.js";
import { adminBillingRouter } from "./modules/billing/admin-billing.routes.js";

export const app = express();

app.disable("x-powered-by");

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    frameguard: { action: "deny" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    noSniff: true,
    xssFilter: true,
  }),
);

app.use(securityHeadersMiddleware);
app.use(requestContextMiddleware);

app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    exposedHeaders: ["Content-Disposition", "X-Request-ID", "X-Correlation-ID"],
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

app.use(
  pinoHttp({
    logger,
    customProps: (request) => ({
      requestId: request.id,
      correlationId: request.correlationId,
      userId: request.auth?.userId,
    }),
    serializers: { res: serializeHttpResponseForLog },
  }),
);

app.get("/", (_request, response) => {
  response.status(200).json({
    success: true,
    message: "Welcome to US Business Lead SaaS API",
  });
});

app.use("/api/v1/health", healthRouter);

// Apply global rate limiting to all business API endpoints
app.use("/api/v1", globalApiRateLimiter);

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/sources", sourceRouter);
app.use("/api/v1/imports", csvImportRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/admin", adminQualityRouter);
app.use("/api/v1/admin/billing", adminBillingRouter);
app.use("/api/v1/billing", billingRouter);
app.use("/api/v1/scraping-jobs", scrapingJobRouter);
app.use("/api/v1/leads", leadRouter);
app.use("/api/v1", leadQualityRouter);
app.use("/api/v1/dashboard", dashboardRouter);

app.use((_request, response) => {
  response.status(404).json({
    success: false,
    message: "Requested API route was not found",
    error: { code: "ROUTE_NOT_FOUND" },
  });
});

app.use(errorHandler);
