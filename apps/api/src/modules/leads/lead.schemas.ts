import { z } from "zod";

export const listLeadsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  scrapingJobId: z.uuid().optional(),
  city: z.string().trim().min(1).max(120).optional(),
  state: z.string().trim().min(1).max(100).optional(),
  category: z.string().trim().min(1).max(150).optional(),
  status: z.enum(["NEW", "VERIFIED", "INVALID", "DUPLICATE", "SUPPRESSED"]).optional(),
  hasPhone: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
});

export const leadIdSchema = z.uuid();
