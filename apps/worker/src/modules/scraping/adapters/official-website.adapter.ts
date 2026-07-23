import { createRequire } from "node:module";
import type { Robot } from "robots-parser";

import { env } from "../../../config/env.js";
import type { ScrapedBusiness } from "../contracts/scraped-business.types.js";
import { ScraperError } from "../errors/scraper.error.js";
import { normalizePhone } from "../services/phone-normalization.service.js";
import { SafeWebsiteHttpService } from "../services/safe-website-http.service.js";
import {
  assertSafeWebsiteUrl,
  isSameBusinessHost,
} from "../services/url-safety.service.js";
import {
  extractWebsiteContacts,
  type WebsiteContactExtraction,
} from "../services/website-contact.extractor.js";

const require = createRequire(import.meta.url);
const robotsParser: typeof import("robots-parser").default =
  require("robots-parser");

export type WebsiteDiscoveryInput = {
  websiteUrl: string;
  googlePlaceId?: string;
  googlePhone?: string;
  expectedName?: string;
  expectedAddress?: string;
  country: string;
  category?: string;
};

const mergeExtraction = (
  current: WebsiteContactExtraction,
  incoming: WebsiteContactExtraction,
): WebsiteContactExtraction => {
  const businessName = current.businessName ?? incoming.businessName;
  const addressLine1 = current.addressLine1 ?? incoming.addressLine1;
  const city = current.city ?? incoming.city;
  const state = current.state ?? incoming.state;
  const postalCode = current.postalCode ?? incoming.postalCode;
  const country = current.country ?? incoming.country;
  const category = current.category ?? incoming.category;
  return {
  phones: [...new Set([...current.phones, ...incoming.phones])],
  emails: [...new Set([...current.emails, ...incoming.emails])],
  ...(businessName ? { businessName } : {}),
  ...(addressLine1 ? { addressLine1 } : {}),
  ...(city ? { city } : {}),
  ...(state ? { state } : {}),
  ...(postalCode ? { postalCode } : {}),
  ...(country ? { country } : {}),
  ...(category ? { category } : {}),
  schemaOrgFound: current.schemaOrgFound || incoming.schemaOrgFound,
  candidateLinks: [...current.candidateLinks, ...incoming.candidateLinks],
  };
};

const emptyExtraction = (): WebsiteContactExtraction => ({
  phones: [],
  emails: [],
  schemaOrgFound: false,
  candidateLinks: [],
});

export class OfficialWebsiteAdapter {
  readonly sourceKey = "official-website" as const;

  async enrich(input: WebsiteDiscoveryInput): Promise<ScrapedBusiness | null> {
    const root = await assertSafeWebsiteUrl(input.websiteUrl);
    root.hash = "";
    const http = new SafeWebsiteHttpService(root);
    const robotsUrl = new URL("/robots.txt", root);
    const robotsResponse = await http.fetchText(robotsUrl, { allowNotFound: true });
    const robots: Robot = robotsParser(
      robotsUrl.toString(),
      robotsResponse?.text ?? "",
    );
    const rootAllowed = robots.isAllowed(root.toString(), env.SCRAPING_USER_AGENT);
    if (rootAllowed === false) {
      throw new ScraperError(
        "Website robots policy disallows crawling",
        "ROBOTS_ACCESS_DISALLOWED",
      );
    }

    const queue: Array<{ url: URL; depth: number }> = [{ url: root, depth: 0 }];
    const seen = new Set<string>();
    let combined = emptyExtraction();
    let sourceUrl = root.toString();

    while (
      queue.length > 0 &&
      seen.size < env.WEBSITE_ENRICHMENT_MAX_PAGES
    ) {
      const next = queue.shift();
      if (!next) break;
      const normalized = next.url.toString();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      if (!isSameBusinessHost(next.url, root)) continue;
      if (
        robots.isAllowed(next.url.toString(), env.SCRAPING_USER_AGENT) === false
      ) {
        continue;
      }
      const response = await http.fetchText(next.url);
      if (!response) continue;
      sourceUrl = response.finalUrl.toString();
      const extraction = extractWebsiteContacts(response.text, response.finalUrl);
      combined = mergeExtraction(combined, extraction);
      if (next.depth >= env.WEBSITE_ENRICHMENT_MAX_DEPTH) continue;
      for (const candidate of extraction.candidateLinks) {
        if (
          queue.length + seen.size >= env.WEBSITE_ENRICHMENT_MAX_PAGES * 2 ||
          !isSameBusinessHost(candidate, root)
        ) {
          continue;
        }
        queue.push({ url: candidate, depth: next.depth + 1 });
      }
    }

    const businessName = combined.businessName?.trim();
    if (!businessName) return null;
    const selectedPhone = combined.phones
      .map((phone) => ({ raw: phone, normalized: normalizePhone(phone) }))
      .find(({ normalized }) => normalized.validationStatus === "VALID");
    const googlePhone = normalizePhone(input.googlePhone);
    const domain = root.hostname.toLowerCase().replace(/^www\./, "");
    const googlePhoneMatched = Boolean(
      selectedPhone?.normalized.e164 &&
        googlePhone.e164 === selectedPhone.normalized.e164,
    );
    const extractionMethod = combined.schemaOrgFound
      ? "SCHEMA_ORG"
      : selectedPhone
        ? "HTML_TEL_LINK"
        : combined.emails.length
          ? "HTML_MAILTO_LINK"
          : "VISIBLE_TEXT";

    return {
      businessName,
      country: combined.country ?? input.country,
      sourceType: "COMPANY_WEBSITE",
      sourceName: root.hostname,
      sourceUrl,
      website: root.toString(),
      officialWebsiteDomain: domain,
      ...(input.googlePlaceId
        ? {
            googlePlaceId: input.googlePlaceId,
            sourceExternalId: input.googlePlaceId,
          }
        : {}),
      ...(selectedPhone ? { phoneRaw: selectedPhone.raw } : {}),
      ...(combined.emails[0] ? { email: combined.emails[0] } : {}),
      ...(combined.addressLine1 ? { addressLine1: combined.addressLine1 } : {}),
      ...(combined.city ? { city: combined.city } : {}),
      ...(combined.state ? { state: combined.state } : {}),
      ...(combined.postalCode ? { postalCode: combined.postalCode } : {}),
      ...(combined.category ?? input.category
        ? { category: combined.category ?? input.category }
        : {}),
      confidenceHints: {
        officialWebsite: true,
        schemaOrg: combined.schemaOrgFound,
        googlePhoneMatched,
        domainMatched: true,
        addressMatched: Boolean(
          input.expectedAddress &&
            combined.addressLine1 &&
            input.expectedAddress
              .toLowerCase()
              .includes(combined.addressLine1.toLowerCase()),
        ),
      },
      provenance: [
        ...(input.googlePlaceId
          ? [
              {
                sourceKey: "google-places-api",
                sourceType: "GOOGLE_PLACES_API" as const,
                sourceRecordId: input.googlePlaceId,
                collectedAt: new Date(),
                extractionMethod: "OFFICIAL_API" as const,
                googlePlaceId: input.googlePlaceId,
                sourceConfidenceScore: googlePhoneMatched ? 75 : 55,
                confidenceContribution: googlePhoneMatched ? 15 : 5,
                metadata: {
                  storagePolicy: "place-id-only",
                  providerContentPersisted: false,
                },
              },
            ]
          : []),
        {
          sourceKey: "official-website",
          sourceType: "OFFICIAL_WEBSITE",
          sourceUrl,
          collectedAt: new Date(),
          extractionMethod,
          ...(selectedPhone?.normalized.e164
            ? {
                phoneRaw: selectedPhone.raw,
                phoneNormalized: selectedPhone.normalized.e164,
              }
            : {}),
          ...(combined.emails[0] ? { email: combined.emails[0] } : {}),
          website: root.toString(),
          sourceConfidenceScore: selectedPhone ? 90 : 65,
          confidenceContribution: selectedPhone ? 45 : 30,
          metadata: {
            schemaOrg: combined.schemaOrgFound,
            pagesChecked: seen.size,
          },
        },
      ],
    };
  }
}
