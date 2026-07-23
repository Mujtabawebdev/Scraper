import type { z } from "zod";

import type {
  exportLeadsQuerySchema,
  listLeadsQuerySchema,
} from "./lead.schemas.js";

export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
export type ExportLeadsQuery = z.infer<typeof exportLeadsQuerySchema>;
export type LeadFilters = Omit<ListLeadsQuery, "page" | "pageSize">;
