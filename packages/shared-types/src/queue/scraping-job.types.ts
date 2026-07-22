export type ScrapingJobQueueData = {
  scrapingJobId: string;
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
  completedAt: string;
};

export type ScrapingJobName = "scrape-businesses";
