import type { ScrapingSourceKey } from "@lead-saas/shared-types";

import { env } from "../../../config/env.js";
import { FixtureBusinessDirectoryScraper } from "../adapters/fixture-business-directory.scraper.js";
import { PermittedHttpDirectoryScraper } from "../adapters/permitted-http-directory.scraper.js";
import { GooglePlacesAdapter } from "../adapters/google-places.adapter.js";
import { GovernmentDatasetAdapter } from "../adapters/government-dataset.adapter.js";
import { ApprovedApiFoundationAdapter } from "../adapters/approved-api-foundation.adapter.js";
import type { BusinessScraper } from "../contracts/scraper.interface.js";
import { SourceNotPermittedError } from "../errors/source-not-permitted.error.js";

export class ScraperRegistry {
  private readonly scrapers = new Map<ScrapingSourceKey, BusinessScraper>();

  constructor() {
    this.register(new FixtureBusinessDirectoryScraper());
    this.register(new GooglePlacesAdapter());
    this.register(new GovernmentDatasetAdapter());
    this.register(
      new ApprovedApiFoundationAdapter(
        "meta-approved-api",
        () => Boolean(env.META_APPROVED_API_ACCESS_TOKEN),
      ),
    );
    this.register(
      new ApprovedApiFoundationAdapter(
        "yelp-approved-api",
        () => Boolean(env.YELP_APPROVED_API_KEY),
      ),
    );
    if (env.SCRAPING_EXTERNAL_SOURCE_ENABLED && env.SCRAPING_APPROVED_BASE_URL) {
      this.register(new PermittedHttpDirectoryScraper());
    }
  }

  register(scraper: BusinessScraper): void {
    this.scrapers.set(scraper.sourceKey, scraper);
  }

  get(sourceKey: ScrapingSourceKey): BusinessScraper {
    const scraper = this.scrapers.get(sourceKey);
    if (!scraper) throw new SourceNotPermittedError();
    return scraper;
  }
}

export const scraperRegistry = new ScraperRegistry();
