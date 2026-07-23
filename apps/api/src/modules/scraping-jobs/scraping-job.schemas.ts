import { z } from "zod";

// Runtime validation remains local so the API can start before the shared-types
// package has been built. Compile-time response contracts still use the shared
// DTO package.
const approvedScrapingSources = [
  "fixture-business-directory",
  "permitted-http-directory",
] as const;
const scrapingJobStatuses = [
  "PENDING",
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

const sortOrderSchema = z.enum(["asc", "desc"]);
const dateQuerySchema = z.union([
  z.iso.date(),
  z.iso.datetime({ offset: true }),
]);
const createdFromSchema = dateQuerySchema.transform((value) =>
  new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value)
);
const createdToSchema = dateQuerySchema.transform((value) =>
  new Date(value.length === 10 ? `${value}T23:59:59.999Z` : value)
);

export const createScrapingJobSchema = z
  .object({
    source: z.enum(approvedScrapingSources),
    searchQuery: z.string().trim().min(2).max(100),
    location: z.string().trim().min(2).max(100),
    requestedLimit: z.number().int().min(1).max(100),
  })
  .strict();

export const listScrapingJobsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(scrapingJobStatuses).optional(),
    source: z.enum(approvedScrapingSources).optional(),
    search: z.string().trim().min(1).max(100).optional(),
    sortBy: z
      .enum(["createdAt", "updatedAt", "status", "progressPercentage", "successCount"])
      .default("createdAt"),
    sortOrder: sortOrderSchema.default("desc"),
    createdFrom: createdFromSchema.optional(),
    createdTo: createdToSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.createdFrom && value.createdTo && value.createdFrom > value.createdTo) {
      context.addIssue({
        code: "custom",
        path: ["createdTo"],
        message: "createdTo must not be earlier than createdFrom",
      });
    }
  });

export const scrapingJobParamsSchema = z
  .object({
    jobId: z.uuid(),
  })
  .strict();

/**
 * Phase 4 compatibility contract. Both values are compiled, allowlisted
 * adapters; the external development source is additionally gated by server
 * configuration. Public callers can never submit a URL.
 */
export const createTestScrapingJobSchema = z
  .object({
    sourceKey: z.enum(["fixture-directory", "permitted-http-directory"]),
    country: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100).optional(),
    city: z.string().trim().min(1).max(120).optional(),
    category: z.string().trim().min(1).max(150).optional(),
    searchQuery: z.string().trim().min(1).max(500),
    requestedLimit: z.number().int().min(1).max(100),
  })
  .strict();

export const scrapingJobIdSchema = z.uuid();
