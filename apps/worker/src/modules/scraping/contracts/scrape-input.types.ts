import type { ScrapingSourceKey } from "@lead-saas/shared-types";

export type ScrapeInput = {
  scrapingJobId: string;
  sourceKey: ScrapingSourceKey;
  country: string;
  state?: string;
  city?: string;
  category?: string;
  searchQuery: string;
  requestedLimit: number;
  requestPolicy?: {
    requestsPerMinute: number;
    maxConcurrency: number;
  };
};
