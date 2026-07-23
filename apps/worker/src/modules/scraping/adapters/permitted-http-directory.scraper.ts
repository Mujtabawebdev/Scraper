import * as cheerio from "cheerio";

import { env } from "../../../config/env.js";
import type { BusinessScraper } from "../contracts/scraper.interface.js";
import type { ScrapeInput } from "../contracts/scrape-input.types.js";
import type { ScrapedBusiness, ScraperResult } from "../contracts/scraped-business.types.js";
import { SourceNotPermittedError } from "../errors/source-not-permitted.error.js";
import { HttpFetchService } from "../services/http-fetch.service.js";
import { RobotsPolicyService } from "../services/robots-policy.service.js";
import { recordRobotsCheck } from "../services/source-policy.service.js";

const clean = (value: string): string | undefined => value.trim() || undefined;

export class PermittedHttpDirectoryScraper implements BusinessScraper {
  readonly sourceKey = "permitted-http-directory" as const;
  private readonly baseUrl: URL;
  private readonly http: HttpFetchService;
  private readonly robots: RobotsPolicyService;

  constructor() {
    if (!env.SCRAPING_EXTERNAL_SOURCE_ENABLED || !env.SCRAPING_APPROVED_BASE_URL) {
      throw new SourceNotPermittedError();
    }
    this.baseUrl = new URL(env.SCRAPING_APPROVED_BASE_URL);
    if (this.baseUrl.protocol !== "http:" && this.baseUrl.protocol !== "https:") {
      throw new SourceNotPermittedError();
    }
    this.http = new HttpFetchService(this.baseUrl.toString());
    this.robots = new RobotsPolicyService(this.baseUrl, this.http);
  }

  async scrape(input: ScrapeInput): Promise<ScraperResult> {
    if (input.requestPolicy) {
      this.http.setRateLimitPolicy(input.requestPolicy);
    }
    const sourceUrl = new URL(this.baseUrl.pathname || "/", this.baseUrl);
    await this.robots.assertAllowed(sourceUrl);
    await recordRobotsCheck(this.sourceKey);
    const html = await this.http.fetchText(sourceUrl, /^text\/html(?:;|$)/i);
    const $ = cheerio.load(html);
    const records: ScrapedBusiness[] = [];

    $("article.business").each((_index, element) => {
      if (records.length >= Math.min(input.requestedLimit, 100)) return false;
      const item = $(element);
      const externalId = clean(item.attr("data-id") ?? "");
      const websiteValue = clean(item.find(".website").attr("href") ?? "");
      const website = websiteValue ? new URL(websiteValue, this.baseUrl).toString() : undefined;
      const phoneRaw = clean(item.find(".phone").text());
      const email = clean(item.find(".email").text());
      const addressLine1 = clean(item.find(".address1").text());
      const addressLine2 = clean(item.find(".address2").text());
      const city = clean(item.find(".city").text());
      const state = clean(item.find(".state").text());
      const postalCode = clean(item.find(".postal").text());
      const category = clean(item.find(".category").text());
      records.push({
        businessName: item.find("h2").text(),
        country: input.country || "United States",
        sourceType: "BUSINESS_DIRECTORY",
        sourceName: this.baseUrl.hostname,
        sourceUrl: sourceUrl.toString(),
        ...(externalId ? { sourceExternalId: externalId } : {}),
        ...(phoneRaw ? { phoneRaw } : {}),
        ...(email ? { email } : {}),
        ...(website ? { website } : {}),
        ...(addressLine1 ? { addressLine1 } : {}),
        ...(addressLine2 ? { addressLine2 } : {}),
        ...(city ? { city } : {}),
        ...(state ? { state } : {}),
        ...(postalCode ? { postalCode } : {}),
        ...(category ? { category } : {}),
      });
    });

    return {
      records,
      pagesProcessed: Math.min(1, env.SCRAPING_MAX_PAGES_PER_JOB),
      skippedRecords: 0,
      sourceKey: this.sourceKey,
    };
  }
}
