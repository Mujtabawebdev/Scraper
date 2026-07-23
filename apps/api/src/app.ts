import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { errorHandler } from "./common/middleware/error.middleware.js";
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

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
    exposedHeaders: ["Content-Disposition"],
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use(
  pinoHttp({
    logger,
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
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/sources", sourceRouter);
app.use("/api/v1/imports", csvImportRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/scraping-jobs", scrapingJobRouter);
app.use("/api/v1/leads", leadRouter);
app.use("/api/v1/dashboard", dashboardRouter);

app.use((_request, response) => {
  response.status(404).json({
    success: false,
    message: "Requested API route was not found",
    error: { code: "ROUTE_NOT_FOUND" },
  });
});

app.use(errorHandler);
