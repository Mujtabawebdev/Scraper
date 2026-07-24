import { Router } from "express";
import {
  getHealthSummary,
  getLivenessProbe,
  getMetrics,
  getReadinessProbe,
} from "./health.controller.js";

export const healthRouter = Router();

healthRouter.get("/", getHealthSummary);
healthRouter.get("/liveness", getLivenessProbe);
healthRouter.get("/readiness", getReadinessProbe);
healthRouter.get("/metrics", getMetrics);
