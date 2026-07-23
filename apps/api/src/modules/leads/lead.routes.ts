import { Router } from "express";

import { authenticate } from "../../common/middleware/authenticate.middleware.js";
import {
  leadExportRateLimiter,
  leadVerificationRateLimiter,
} from "../../common/middleware/resource-rate-limit.middleware.js";
import {
  detail,
  exportCsv,
  list,
  provenance,
  verify,
} from "./lead.controller.js";

export const leadRouter = Router();

leadRouter.use(authenticate);
leadRouter.get("/", list);
leadRouter.get("/export.csv", leadExportRateLimiter, exportCsv);
leadRouter.post("/:leadId/verify", leadVerificationRateLimiter, verify);
leadRouter.get("/:leadId/provenance", provenance);
leadRouter.get("/:leadId", detail);
