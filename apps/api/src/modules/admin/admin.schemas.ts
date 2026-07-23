import { z } from "zod";

const userRoles = ["USER", "ADMIN", "SUPER_ADMIN"] as const;
const userStatuses = ["ACTIVE", "SUSPENDED", "DISABLED"] as const;
const jobStatuses = [
  "PENDING",
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
const sourceTypes = [
  "FIXTURE",
  "OFFICIAL_API",
  "GOOGLE_PLACES_API",
  "PUBLIC_DIRECTORY",
  "GOVERNMENT_DATASET",
  "OFFICIAL_WEBSITE",
  "LICENSED_DATASET",
  "CSV_IMPORT",
  "META_APPROVED_API",
  "YELP_APPROVED_API",
] as const;
const sourceStatuses = [
  "APPROVED",
  "DISABLED",
  "BLOCKED",
  "REVIEW_REQUIRED",
] as const;

const sortOrderSchema = z.enum(["asc", "desc"]);
const optionalBooleanSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();
const dateQuerySchema = z.union([
  z.iso.date(),
  z.iso.datetime({ offset: true }),
]);
const createdFromSchema = dateQuerySchema.transform((value) =>
  new Date(value.length === 10 ? `${value}T00:00:00.000Z` : value),
);
const createdToSchema = dateQuerySchema.transform((value) =>
  new Date(value.length === 10 ? `${value}T23:59:59.999Z` : value),
);
const optionalTimestampBodySchema = z
  .iso.datetime({ offset: true })
  .transform((value) => new Date(value))
  .nullable()
  .optional();

const addDateRangeValidation = <Schema extends z.ZodObject>(schema: Schema) =>
  schema.superRefine((value, context) => {
    const createdFrom = value.createdFrom as Date | undefined;
    const createdTo = value.createdTo as Date | undefined;
    if (createdFrom && createdTo && createdFrom > createdTo) {
      context.addIssue({
        code: "custom",
        path: ["createdTo"],
        message: "createdTo must not be earlier than createdFrom",
      });
    }
  });

export const adminUserParamsSchema = z
  .object({ userId: z.uuid() })
  .strict();

export const adminJobParamsSchema = z
  .object({ jobId: z.uuid() })
  .strict();

export const adminSourceParamsSchema = z
  .object({ sourceId: z.uuid() })
  .strict();

export const listAdminUsersQuerySchema = addDateRangeValidation(
  z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      search: z.string().trim().min(1).max(100).optional(),
      role: z.enum(userRoles).optional(),
      status: z.enum(userStatuses).optional(),
      sortBy: z
        .enum([
          "createdAt",
          "updatedAt",
          "fullName",
          "email",
          "role",
          "status",
          "lastLoginAt",
        ])
        .default("createdAt"),
      sortOrder: sortOrderSchema.default("desc"),
      createdFrom: createdFromSchema.optional(),
      createdTo: createdToSchema.optional(),
    })
    .strict(),
);

export const updateAdminUserStatusSchema = z
  .object({
    status: z.enum(userStatuses),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();

export const updateAdminUserRoleSchema = z
  .object({
    role: z.enum(userRoles),
    reason: z.string().trim().min(5).max(500),
  })
  .strict();

export const listAdminJobsQuerySchema = addDateRangeValidation(
  z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      userId: z.uuid().optional(),
      userEmail: z.email().trim().toLowerCase().optional(),
      status: z.enum(jobStatuses).optional(),
      source: z.string().trim().min(1).max(100).optional(),
      search: z.string().trim().min(1).max(100).optional(),
      sortBy: z
        .enum([
          "createdAt",
          "updatedAt",
          "status",
          "progressPercentage",
          "successCount",
        ])
        .default("createdAt"),
      sortOrder: sortOrderSchema.default("desc"),
      createdFrom: createdFromSchema.optional(),
      createdTo: createdToSchema.optional(),
    })
    .strict(),
);

export const cancelAdminJobSchema = z
  .object({
    reason: z.string().trim().min(5).max(500),
  })
  .strict();

export const listAdminAuditLogsQuerySchema = addDateRangeValidation(
  z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(20),
      action: z.string().trim().min(1).max(100).optional(),
      actorUserId: z.uuid().optional(),
      targetUserId: z.uuid().optional(),
      entityType: z.string().trim().min(1).max(100).optional(),
      entityId: z.string().trim().min(1).max(255).optional(),
      search: z.string().trim().min(1).max(100).optional(),
      createdFrom: createdFromSchema.optional(),
      createdTo: createdToSchema.optional(),
    })
    .strict(),
);

export const listAdminSourcesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().min(1).max(100).optional(),
    sourceType: z.enum(sourceTypes).optional(),
    status: z.enum(sourceStatuses).optional(),
    isEnabled: optionalBooleanSchema,
    sortBy: z
      .enum(["createdAt", "updatedAt", "displayName", "key", "status", "sourceType"])
      .default("updatedAt"),
    sortOrder: sortOrderSchema.default("desc"),
  })
  .strict();

const sourceKeySchema = z
  .string()
  .trim()
  .min(3)
  .max(100)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Source key must use lowercase letters, numbers, and single hyphens",
  );

const nullableHttpUrlSchema = z
  .union([z.url(), z.null()])
  .optional();

export const createAdminSourceSchema = z
  .object({
    key: sourceKeySchema,
    displayName: z.string().trim().min(2).max(150),
    sourceType: z.enum(sourceTypes),
    baseUrl: nullableHttpUrlSchema,
    requiresApiKey: z.boolean().default(false),
    requestsPerMinute: z.number().int().min(1).max(120).default(10),
    maxConcurrency: z.number().int().min(1).max(10).default(1),
    robotsPolicyCheckedAt: optionalTimestampBodySchema,
    termsReviewedAt: optionalTimestampBodySchema,
    reviewNotes: z.string().trim().min(5).max(2_000).optional(),
  })
  .strict();

export const updateAdminSourceSchema = z
  .object({
    displayName: z.string().trim().min(2).max(150).optional(),
    sourceType: z.enum(sourceTypes).optional(),
    baseUrl: nullableHttpUrlSchema,
    status: z.enum(sourceStatuses).optional(),
    isEnabled: z.boolean().optional(),
    requiresApiKey: z.boolean().optional(),
    allowsAutomatedAccess: z.boolean().optional(),
    requestsPerMinute: z.number().int().min(1).max(120).optional(),
    maxConcurrency: z.number().int().min(1).max(10).optional(),
    robotsPolicyCheckedAt: optionalTimestampBodySchema,
    termsReviewedAt: optionalTimestampBodySchema,
    reviewNotes: z.union([z.string().trim().min(5).max(2_000), z.null()]).optional(),
    blockedReason: z.union([z.string().trim().min(5).max(500), z.null()]).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one source field must be provided",
  });

export const sourceReasonSchema = z
  .object({
    reason: z.string().trim().min(5).max(500),
  })
  .strict();
