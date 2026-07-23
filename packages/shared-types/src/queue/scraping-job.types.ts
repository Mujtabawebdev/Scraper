export type ScrapingJobQueueData = {
  scrapingJobId: string;
  sourceKey: ScrapingSourceKey;
  source: ScrapingJobQueueSource;
  country: string;
  state?: string;
  city?: string;
  category?: string;
  searchQuery: string;
  requestedLimit: number;
  requestedById: string;
};

export type ScrapingJobQueueResult = {
  scrapingJobId: string;
  processedCount: number;
  successCount: number;
  failureCount: number;
  duplicateCount: number;
  completedAt: string;
};

export type ScrapingJobName = "scrape-businesses";

export type ScrapingSourceKey = "fixture-directory" | "permitted-http-directory";

export type ScrapingJobQueueSource =
  | "fixture-business-directory"
  | "permitted-http-directory";
