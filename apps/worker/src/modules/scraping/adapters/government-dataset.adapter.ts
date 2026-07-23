import { env } from "../../../config/env.js";
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

export type GovernmentDatasetRecord = Readonly<Record<string, unknown>>;

/**
 * Production contract for an official CSV, JSON, downloadable file, or API.
 * No source-specific parser is claimed until GOVERNMENT_DATASET_URL points at
 * a reviewed official dataset and a concrete mapper is registered.
 */
export class GovernmentDatasetAdapter
  implements SourceAdapter<GovernmentDatasetRecord, GovernmentDatasetRecord>
{
  readonly sourceKey = "government-dataset" as const;

  validateConfiguration(): AdapterConfiguration {
    return env.GOVERNMENT_DATASET_URL
      ? {
          configured: false,
          reason: "Dataset URL is configured but no reviewed field mapper is active",
        }
      : {
          configured: false,
          reason: "No reviewed government dataset is configured",
        };
  }

  getRateLimitPolicy(): AdapterRateLimitPolicy {
    return { requestsPerMinute: 5, maxConcurrency: 1 };
  }

  async healthCheck(): Promise<AdapterHealth> {
    return {
      status: "CONFIGURATION_MISSING",
      message: this.validateConfiguration().reason ?? "Dataset unavailable",
    };
  }

  async search(_input: ScrapeInput): Promise<GovernmentDatasetRecord[]> {
    throw new ScraperError(
      "No reviewed government dataset mapper is configured",
      "SOURCE_NOT_CONFIGURED",
    );
  }

  async fetchDetails(
    record: GovernmentDatasetRecord,
  ): Promise<GovernmentDatasetRecord> {
    return record;
  }

  async normalize(
    _record: GovernmentDatasetRecord,
  ): Promise<ScrapedBusiness | null> {
    return null;
  }

  async scrape(_input: ScrapeInput): Promise<ScraperResult> {
    throw new ScraperError(
      "No reviewed government dataset mapper is configured",
      "SOURCE_NOT_CONFIGURED",
    );
  }
}
