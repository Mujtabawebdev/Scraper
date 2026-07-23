export const dashboardQueryKeys = {
  all: ["dashboard"] as const,
  summary: () => ["dashboard", "summary"] as const,
} as const;
