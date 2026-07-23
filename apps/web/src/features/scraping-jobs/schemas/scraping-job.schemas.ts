import { z } from "zod";

import { APPROVED_SOURCE_OPTIONS } from "../types/scraping-job.types";

const approvedSourceValues = [
  APPROVED_SOURCE_OPTIONS[0].value,
  APPROVED_SOURCE_OPTIONS[1].value,
] as const;

const normalizedRequiredText = (label: string) =>
  z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(2, `${label} must contain at least 2 characters`)
        .max(100, `${label} must contain at most 100 characters`),
    );

export const createScrapingJobSchema = z
  .object({
    source: z.enum(approvedSourceValues, {
      error: "Select an approved scraping source",
    }),
    searchQuery: normalizedRequiredText("Search query"),
    location: normalizedRequiredText("Location"),
    requestedLimit: z
      .number()
      .int("Requested lead limit must be a whole number")
      .min(1, "Requested lead limit must be at least 1")
      .max(100, "Requested lead limit must be at most 100"),
  })
  .strict();

export type CreateScrapingJobFormInput = z.input<
  typeof createScrapingJobSchema
>;
export type CreateScrapingJobFormValues = z.output<
  typeof createScrapingJobSchema
>;
