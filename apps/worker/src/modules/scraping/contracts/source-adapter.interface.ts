import type { ScrapeInput } from "./scrape-input.types.js";
import type {
  ScrapedBusiness,
  ScraperResult,
} from "./scraped-business.types.js";

export type AdapterConfiguration = {
  configured: boolean;
  reason?: string;
};

export type AdapterHealth = {
  status:
    | "HEALTHY"
    | "DEGRADED"
    | "UNAVAILABLE"
    | "CONFIGURATION_MISSING"
    | "QUOTA_LIMITED";
  message: string;
  latencyMs?: number;
  retryAt?: Date;
};

export type AdapterRateLimitPolicy = {
  requestsPerMinute: number;
  maxConcurrency: number;
};

export interface SourceAdapter<DiscoveredRecord = unknown, DetailRecord = unknown> {
  readonly sourceKey: string;
  validateConfiguration(): AdapterConfiguration;
  healthCheck(): Promise<AdapterHealth>;
  search(input: ScrapeInput): Promise<DiscoveredRecord[]>;
  fetchDetails(record: DiscoveredRecord): Promise<DetailRecord>;
  normalize(record: DetailRecord): Promise<ScrapedBusiness | null>;
  getRateLimitPolicy(): AdapterRateLimitPolicy;
  scrape(input: ScrapeInput): Promise<ScraperResult>;
}
