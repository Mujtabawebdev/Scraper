import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";

import { logger } from "./common/logger/logger.js";
import { env } from "./config/env.js";
import { healthRouter } from "./modules/health/health.routes.js";
import { scrapingJobRouter } from "./modules/scraping-jobs/scraping-job.routes.js";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use(pinoHttp({ logger }));

app.get("/", (_request, response) => {
  response.status(200).json({
    success: true,
    message: "Welcome to US Business Lead SaaS API",
  });
});

app.use("/api/v1/health", healthRouter);
app.use("/api/v1/scraping-jobs", scrapingJobRouter);

app.use((_request, response) => {
  response.status(404).json({
    success: false,
    message: "Requested API route was not found",
    error: { code: "ROUTE_NOT_FOUND" },
  });
});
