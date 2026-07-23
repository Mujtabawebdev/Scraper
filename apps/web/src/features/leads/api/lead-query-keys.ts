import type { LeadListFilters } from "../types/lead.types";

export const leadQueryKeys = {
  all: ["leads"] as const,
  lists: () => ["leads", "list"] as const,
  list: (filters: LeadListFilters) => ["leads", "list", filters] as const,
  details: () => ["leads", "detail"] as const,
  detail: (leadId: string) => ["leads", "detail", leadId] as const,
  provenance: (leadId: string) =>
    ["leads", "provenance", leadId] as const,
} as const;
