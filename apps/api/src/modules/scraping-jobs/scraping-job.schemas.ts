import { z } from "zod";

export const createTestScrapingJobSchema = z
  .object({
    country: z.string().trim().min(1).max(100),
    state: z.string().trim().min(1).max(100).optional(),
    city: z.string().trim().min(1).max(120).optional(),
    category: z.string().trim().min(1).max(150).optional(),
    searchQuery: z.string().trim().min(1).max(500),
    requestedLimit: z.number().int().min(1).max(100),
  })
  .strict();

export const scrapingJobIdSchema = z.uuid();
