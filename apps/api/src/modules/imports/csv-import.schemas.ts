import { z } from "zod";

import { csvCanonicalFields } from "./csv-import.types.js";

export const csvImportFieldsSchema = z
  .object({
    rightsConfirmed: z
      .enum(["true"])
      .transform(() => true),
    sourceName: z.string().trim().min(2).max(150),
    headerMapping: z.string().trim().optional(),
  })
  .strict();

export const csvImportParamsSchema = z
  .object({ importId: z.uuid() })
  .strict();

export const parseHeaderMapping = (
  value: string | undefined,
): Partial<Record<(typeof csvCanonicalFields)[number], string>> => {
  if (!value) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Header mapping must be valid JSON");
  }
  return z
    .record(z.enum(csvCanonicalFields), z.string().trim().min(1).max(100))
    .parse(parsed);
};
