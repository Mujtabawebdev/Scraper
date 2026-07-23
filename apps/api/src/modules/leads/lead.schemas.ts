import { z } from "zod";

const optionalBooleanSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();
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

const leadFilterShape = {
  search: z.string().trim().min(1).max(100).optional(),
  jobId: z.uuid().optional(),
  source: z
    .enum(["fixture-business-directory", "permitted-http-directory"])
    .optional(),
  category: z.string().trim().min(1).max(150).optional(),
  city: z.string().trim().min(1).max(120).optional(),
  state: z.string().trim().min(1).max(100).optional(),
  hasPhone: optionalBooleanSchema,
  hasEmail: optionalBooleanSchema,
  hasWebsite: optionalBooleanSchema,
  sortBy: z
    .enum(["createdAt", "businessName", "city", "state", "source"])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  createdFrom: createdFromSchema.optional(),
  createdTo: createdToSchema.optional(),
} as const;

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

export const listLeadsQuerySchema = addDateRangeValidation(
  z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25),
      ...leadFilterShape,
    })
    .strict(),
);

export const exportLeadsQuerySchema = addDateRangeValidation(
  z.object(leadFilterShape).strict(),
);

export const leadParamsSchema = z
  .object({
    leadId: z.uuid(),
  })
  .strict();

export const leadIdSchema = z.uuid();
