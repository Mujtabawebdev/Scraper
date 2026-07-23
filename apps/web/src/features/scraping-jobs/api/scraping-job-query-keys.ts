import type { ScrapingJobListFilters } from "../types/scraping-job.types";

export const scrapingJobQueryKeys = {
  all: ["scraping-jobs"] as const,
  lists: () => ["scraping-jobs", "list"] as const,
  list: (filters: ScrapingJobListFilters) =>
    ["scraping-jobs", "list", filters] as const,
  details: () => ["scraping-jobs", "detail"] as const,
  detail: (jobId: string) => ["scraping-jobs", "detail", jobId] as const,
} as const;
