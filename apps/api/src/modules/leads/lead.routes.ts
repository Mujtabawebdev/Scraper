import { Router } from "express";

import { authenticate } from "../../common/middleware/authenticate.middleware.js";
import { leadExportRateLimiter } from "../../common/middleware/resource-rate-limit.middleware.js";
import { detail, exportCsv, list } from "./lead.controller.js";

export const leadRouter = Router();

leadRouter.use(authenticate);
leadRouter.get("/", list);
leadRouter.get("/export.csv", leadExportRateLimiter, exportCsv);
leadRouter.get("/:leadId", detail);
