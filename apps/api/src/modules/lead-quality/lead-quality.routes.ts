import { Router } from "express";
import { authenticate } from "../../common/middleware/authenticate.middleware.js";
import { authorizeRoles } from "../../common/middleware/authorize.middleware.js";
import { leadVerificationRateLimiter } from "../../common/middleware/resource-rate-limit.middleware.js";
import {
  confirmDuplicateCandidate,
  executeMerge,
  getAdminQualityDashboardSummary,
  getDuplicateCandidates,
  getLeadQualitySummary,
  getLeadVerifications,
  getUserQualityDashboardSummary,
  previewMerge,
  rejectDuplicateCandidate,
  verifyBulkLeads,
  verifySingleLead,
} from "./lead-quality.controller.js";

export const leadQualityRouter = Router();

// User authenticated endpoints
leadQualityRouter.use(authenticate);

leadQualityRouter.get("/dashboard/quality", getUserQualityDashboardSummary);
leadQualityRouter.post("/leads/verify-bulk", leadVerificationRateLimiter, verifyBulkLeads);
leadQualityRouter.post("/leads/merge/preview", previewMerge);
leadQualityRouter.post("/leads/merge", executeMerge);

leadQualityRouter.get("/leads/:leadId/quality", getLeadQualitySummary);
leadQualityRouter.get("/leads/:leadId/verifications", getLeadVerifications);
leadQualityRouter.post("/leads/:leadId/verify", leadVerificationRateLimiter, verifySingleLead);
leadQualityRouter.get("/leads/:leadId/duplicate-candidates", getDuplicateCandidates);
leadQualityRouter.post(
  "/leads/:leadId/duplicate-candidates/:candidateId/confirm",
  confirmDuplicateCandidate
);
leadQualityRouter.post(
  "/leads/:leadId/duplicate-candidates/:candidateId/reject",
  rejectDuplicateCandidate
);

// Admin quality router
export const adminQualityRouter = Router();
adminQualityRouter.use(authenticate, authorizeRoles("ADMIN", "SUPER_ADMIN"));
adminQualityRouter.get("/lead-quality/summary", getAdminQualityDashboardSummary);
