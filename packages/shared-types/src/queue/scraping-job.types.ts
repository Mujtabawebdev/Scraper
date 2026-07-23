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

export const acquisitionStages = [
  "DISCOVER_BUSINESSES",
  "FETCH_SOURCE_DETAILS",
  "DISCOVER_OFFICIAL_WEBSITE",
  "CRAWL_PUBLIC_CONTACT_PAGES",
  "EXTRACT_CONTACT_DATA",
  "NORMALIZE_PHONE",
  "VALIDATE_PHONE",
  "DEDUPLICATE",
  "SCORE_CONFIDENCE",
  "PERSIST_LEAD",
  "COMPLETE_JOB",
] as const;

export type AcquisitionStage = (typeof acquisitionStages)[number];

export type ScrapingSourceKey =
  | "fixture-directory"
  | "permitted-http-directory"
  | "google-places-api"
  | "government-dataset"
  | "meta-approved-api"
  | "yelp-approved-api";

export type ScrapingJobQueueSource =
  | "fixture-business-directory"
  | "permitted-http-directory"
  | "google-places-api"
  | "government-dataset"
  | "meta-approved-api"
  | "yelp-approved-api";
