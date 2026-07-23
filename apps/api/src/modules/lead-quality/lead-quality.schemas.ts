import { z } from "zod";

export const leadIdParamSchema = z.object({
  leadId: z.string().uuid("Lead ID must be a valid UUID"),
});

export const duplicateCandidateParamSchema = z.object({
  leadId: z.string().uuid("Lead ID must be a valid UUID"),
  candidateId: z.string().uuid("Candidate ID must be a valid UUID"),
});

export const bulkVerifySchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1, "At least one lead ID is required").max(100, "Maximum batch size is 100 leads"),
  verificationTypes: z.array(z.enum(["PHONE", "EMAIL", "WEBSITE"])).optional(),
});

export const mergePreviewSchema = z.object({
  canonicalLeadId: z.string().uuid("Canonical Lead ID must be a valid UUID"),
  candidateLeadId: z.string().uuid("Candidate Lead ID must be a valid UUID"),
});

export const confirmMergeSchema = z.object({
  canonicalLeadId: z.string().uuid("Canonical Lead ID must be a valid UUID"),
  candidateLeadId: z.string().uuid("Candidate Lead ID must be a valid UUID"),
  reason: z.string().max(500, "Reason must not exceed 500 characters").optional(),
});

export const leadQualityQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  qualityMin: z.coerce.number().int().min(0).max(100).optional(),
  qualityMax: z.coerce.number().int().min(0).max(100).optional(),
  completenessMin: z.coerce.number().int().min(0).max(100).optional(),
  confidenceLevel: z.enum(["HIGH", "MEDIUM", "LOW", "VERY_LOW"]).optional(),
  verificationStatus: z
    .enum([
      "UNVERIFIED",
      "PARTIALLY_VERIFIED",
      "VERIFIED",
      "VERIFICATION_FAILED",
      "CONFLICTING",
      "STALE",
      "NO_CONTACT_DATA",
    ])
    .optional(),
  freshnessStatus: z.enum(["FRESH", "AGING", "STALE", "UNKNOWN"]).optional(),
  reviewStatus: z.enum(["NOT_REQUIRED", "REVIEW_REQUIRED", "IN_REVIEW", "APPROVED", "REJECTED"]).optional(),
  staleOnly: z
    .preprocess((val) => val === "true" || val === true, z.boolean())
    .optional(),
  sortBy: z.enum(["qualityScore", "completenessScore", "confidenceScore", "lastVerifiedAt", "createdAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});
