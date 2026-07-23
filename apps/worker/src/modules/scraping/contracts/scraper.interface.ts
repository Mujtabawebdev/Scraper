import type { ScrapeInput } from "./scrape-input.types.js";
import type { ScraperResult } from "./scraped-business.types.js";

export interface BusinessScraper {
  readonly sourceKey: ScrapeInput["sourceKey"];
  scrape(input: ScrapeInput): Promise<ScraperResult>;
}
