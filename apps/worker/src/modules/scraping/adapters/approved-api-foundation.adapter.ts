import type { ScrapeInput } from "../contracts/scrape-input.types.js";
import type {
  ScrapedBusiness,
  ScraperResult,
} from "../contracts/scraped-business.types.js";
import type {
  AdapterConfiguration,
  AdapterHealth,
  AdapterRateLimitPolicy,
  SourceAdapter,
} from "../contracts/source-adapter.interface.js";
import { ScraperError } from "../errors/scraper.error.js";

export class ApprovedApiFoundationAdapter
  implements SourceAdapter<never, never>
{
  constructor(
    readonly sourceKey: "meta-approved-api" | "yelp-approved-api",
    private readonly credentialConfigured: () => boolean,
  ) {}

  validateConfiguration(): AdapterConfiguration {
    return this.credentialConfigured()
      ? {
          configured: false,
          reason: "Credential exists but no reviewed provider contract is enabled",
        }
      : { configured: false, reason: "Approved API credentials are missing" };
  }

  getRateLimitPolicy(): AdapterRateLimitPolicy {
    return { requestsPerMinute: 5, maxConcurrency: 1 };
  }

  async healthCheck(): Promise<AdapterHealth> {
    return {
      status: "CONFIGURATION_MISSING",
      message: this.validateConfiguration().reason ?? "Provider unavailable",
    };
  }

  async search(_input: ScrapeInput): Promise<never[]> {
    throw new ScraperError(
      "Approved provider integration is not configured",
      "SOURCE_NOT_CONFIGURED",
    );
  }

  async fetchDetails(record: never): Promise<never> {
    return record;
  }

  async normalize(_record: never): Promise<ScrapedBusiness | null> {
    return null;
  }

  async scrape(_input: ScrapeInput): Promise<ScraperResult> {
    throw new ScraperError(
      "Approved provider integration is not configured",
      "SOURCE_NOT_CONFIGURED",
    );
  }
}
