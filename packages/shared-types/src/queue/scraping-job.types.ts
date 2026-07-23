export type ScrapingJobQueueData = {
  scrapingJobId: string;
  sourceKey: ScrapingSourceKey;
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
  collectedCount: number;
  failedCount: number;
  skippedCount: number;
  completedAt: string;
};

export type ScrapingJobName = "scrape-businesses";

export type ScrapingSourceKey = "fixture-directory" | "permitted-http-directory";
