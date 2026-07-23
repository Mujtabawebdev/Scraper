import { readFile } from "node:fs/promises";
import * as cheerio from "cheerio";

import type { BusinessScraper } from "../contracts/scraper.interface.js";
import type { ScrapeInput } from "../contracts/scrape-input.types.js";
import type { ScrapedBusiness, ScraperResult } from "../contracts/scraped-business.types.js";

const textOrUndefined = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed || undefined;
};

const stateCode = (value: string): string => {
  const normalized = value.trim().toUpperCase();
  const names: Record<string, string> = {
    TEXAS: "TX",
    CALIFORNIA: "CA",
    "NEW YORK": "NY",
    FLORIDA: "FL",
    WASHINGTON: "WA",
    COLORADO: "CO",
  };
  return names[normalized] ?? normalized;
};

export class FixtureBusinessDirectoryScraper implements BusinessScraper {
  readonly sourceKey = "fixture-directory" as const;

  async scrape(input: ScrapeInput): Promise<ScraperResult> {
    const sourceFixture = new URL("../fixtures/us-business-directory.html", import.meta.url);
    const developmentFixture = new URL(
      "../../../../src/modules/scraping/fixtures/us-business-directory.html",
      import.meta.url,
    );
    let html: string;
    try {
      html = await readFile(sourceFixture, "utf8");
    } catch {
      html = await readFile(developmentFixture, "utf8");
    }

    const $ = cheerio.load(html);
    const records: ScrapedBusiness[] = [];

    $("article.business").each((_index, element) => {
      if (records.length >= Math.min(input.requestedLimit, 100)) return false;
      const item = $(element);
      const city = textOrUndefined(item.find(".city").text());
      const state = textOrUndefined(item.find(".state").text());
      const category = textOrUndefined(item.find(".category").text());
      const phoneRaw = textOrUndefined(item.find(".phone").text());
      const email = textOrUndefined(item.find(".email").text());
      const website = textOrUndefined(item.find(".website").attr("href") ?? "");
      const addressLine1 = textOrUndefined(item.find(".address1").text());
      const addressLine2 = textOrUndefined(item.find(".address2").text());
      const postalCode = textOrUndefined(item.find(".postal").text());
      if (input.city && city?.toLowerCase() !== input.city.toLowerCase()) return;
      if (input.state && (!state || stateCode(state) !== stateCode(input.state))) return;
      if (input.category && category?.toLowerCase() !== input.category.toLowerCase()) return;

      const externalId = textOrUndefined(item.attr("data-id") ?? "");
      records.push({
        businessName: item.find("h2").text(),
        country: "United States",
        sourceType: "BUSINESS_DIRECTORY",
        sourceName: "Local Fictional Business Directory Fixture",
        sourceUrl: `fixture://us-business-directory/${externalId ?? "unknown"}`,
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

    return { records, pagesProcessed: 1, skippedRecords: 0, sourceKey: this.sourceKey };
  }
}
