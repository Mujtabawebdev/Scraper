export const leadQualityQueryKeys = {
  all: ["leadQuality"] as const,
  detail: (leadId: string) => ["leadQuality", "detail", leadId] as const,
  verifications: (leadId: string) => ["leadQuality", "verifications", leadId] as const,
  issues: (leadId: string) => ["leadQuality", "issues", leadId] as const,
  duplicates: (leadId: string) => ["leadQuality", "duplicates", leadId] as const,
  summary: () => ["leadQuality", "summary"] as const,
} as const;

export const adminLeadQualityQueryKeys = {
  all: ["adminLeadQuality"] as const,
  summary: (filters?: Record<string, unknown>) => ["adminLeadQuality", "summary", filters] as const,
  issues: (filters?: Record<string, unknown>) => ["adminLeadQuality", "issues", filters] as const,
  duplicates: (filters?: Record<string, unknown>) => ["adminLeadQuality", "duplicates", filters] as const,
} as const;
