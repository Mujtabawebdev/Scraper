import { fetch, type Response } from "undici";

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
import { OfficialWebsiteAdapter } from "./official-website.adapter.js";

const TEXT_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchText";
const PLACE_DETAILS_BASE = "https://places.googleapis.com/v1/places";
const MAX_RETRIES = 2;

type GooglePlaceIdRecord = { id: string };

type GoogleTextSearchResponse = {
  places?: GooglePlaceIdRecord[];
  nextPageToken?: string;
};

type GoogleDisplayName = { text?: string };
type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

export type GooglePlaceDetails = {
  id: string;
  displayName?: GoogleDisplayName;
  formattedAddress?: string;
  addressComponents?: GoogleAddressComponent[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  types?: string[];
  businessStatus?: string;
};

const retryAfterMs = (response: Response, attempt: number): number => {
  const value = response.headers.get("retry-after");
  if (value) {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) {
      return Math.min(60_000, Math.max(0, seconds * 1_000));
    }
    const date = Date.parse(value);
    if (Number.isFinite(date)) {
      return Math.min(60_000, Math.max(0, date - Date.now()));
    }
  }
  return Math.min(5_000, 1_000 * 2 ** attempt);
};

const safeGoogleError = (status: number): ScraperError => {
  if (status === 401 || status === 403) {
    return new ScraperError(
      "Google Places credentials are invalid or unauthorized",
      "API_CREDENTIALS_MISSING",
    );
  }
  if (status === 429) {
    return new ScraperError(
      "Google Places quota is currently unavailable",
      "API_QUOTA_EXCEEDED",
    );
  }
  if (status >= 400 && status < 500) {
    return new ScraperError(
      "Google Places rejected the request",
      "SOURCE_REQUEST_FAILED",
    );
  }
  return new ScraperError(
    "Google Places request failed",
    "SOURCE_REQUEST_FAILED",
  );
};

const component = (
  details: GooglePlaceDetails,
  type: string,
  preferShort = false,
): string | undefined => {
  const item = details.addressComponents?.find((entry) =>
    entry.types?.includes(type),
  );
  return preferShort ? item?.shortText ?? item?.longText : item?.longText;
};

export class GooglePlacesAdapter
  implements SourceAdapter<GooglePlaceIdRecord, GooglePlaceDetails>
{
  readonly sourceKey = "google-places-api" as const;
  private readonly website = new OfficialWebsiteAdapter();

  validateConfiguration(): AdapterConfiguration {
    return env.GOOGLE_PLACES_API_KEY
      ? { configured: true }
      : {
          configured: false,
          reason: "Google Places API credentials are not configured",
        };
  }

  getRateLimitPolicy(): AdapterRateLimitPolicy {
    return { requestsPerMinute: 30, maxConcurrency: 1 };
  }

  private requireKey(): string {
    const key = env.GOOGLE_PLACES_API_KEY;
    if (!key) {
      throw new ScraperError(
        "Google Places API credentials are not configured",
        "API_CREDENTIALS_MISSING",
      );
    }
    return key;
  }

  private async requestJson<T>(
    url: string,
    init: {
      method: "GET" | "POST";
      fieldMask: string;
      body?: Readonly<Record<string, unknown>>;
    },
  ): Promise<T> {
    const key = this.requireKey();
    let response: Response | undefined;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      response = await fetch(url, {
        method: init.method,
        signal: AbortSignal.timeout(env.GOOGLE_PLACES_REQUEST_TIMEOUT_MS),
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": key,
          "x-goog-fieldmask": init.fieldMask,
        },
        ...(init.body ? { body: JSON.stringify(init.body) } : {}),
      });
      if (
        (response.status === 429 || response.status >= 500) &&
        attempt < MAX_RETRIES
      ) {
        const delay = retryAfterMs(response, attempt);
        await response.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      break;
    }
    if (!response?.ok) throw safeGoogleError(response?.status ?? 500);
    try {
      return (await response.json()) as T;
    } catch {
      throw new ScraperError(
        "Google Places returned an invalid response",
        "SOURCE_REQUEST_FAILED",
      );
    }
  }

  private searchTextQuery(input: ScrapeInput): string {
    const business = input.category?.trim() || input.searchQuery.trim();
    const location = [input.city, input.state, input.country]
      .filter(Boolean)
      .join(", ");
    return location ? `${business} in ${location}` : business;
  }

  async search(input: ScrapeInput): Promise<GooglePlaceIdRecord[]> {
    const records: GooglePlaceIdRecord[] = [];
    let pageToken: string | undefined;
    const pageSize = Math.min(20, input.requestedLimit);
    for (
      let page = 0;
      page < env.GOOGLE_PLACES_MAX_PAGES_PER_JOB &&
      records.length < input.requestedLimit;
      page += 1
    ) {
      const result = await this.requestJson<GoogleTextSearchResponse>(
        TEXT_SEARCH_URL,
        {
          method: "POST",
          // The discovery call deliberately requests only exempt Place IDs.
          fieldMask: "places.id,nextPageToken",
          body: {
            textQuery: this.searchTextQuery(input),
            pageSize,
            regionCode: env.GOOGLE_PLACES_REGION,
            languageCode: env.GOOGLE_PLACES_LANGUAGE,
            includePureServiceAreaBusinesses: true,
            ...(pageToken ? { pageToken } : {}),
          },
        },
      );
      records.push(
        ...(result.places ?? [])
          .filter((place) => typeof place.id === "string" && place.id.length > 0)
          .slice(0, input.requestedLimit - records.length),
      );
      pageToken = result.nextPageToken;
      if (!pageToken) break;
    }
    return records;
  }

  async fetchDetails(record: GooglePlaceIdRecord): Promise<GooglePlaceDetails> {
    const placeId = encodeURIComponent(record.id);
    return this.requestJson<GooglePlaceDetails>(
      `${PLACE_DETAILS_BASE}/${placeId}`,
      {
        method: "GET",
        fieldMask:
          "id,displayName,formattedAddress,addressComponents,nationalPhoneNumber,internationalPhoneNumber,websiteUri,types,businessStatus",
      },
    );
  }

  async normalize(
    details: GooglePlaceDetails,
  ): Promise<ScrapedBusiness | null> {
    if (!details.websiteUri || details.businessStatus === "CLOSED_PERMANENTLY") {
      return null;
    }
    const country = component(details, "country") ?? "United States";
    return this.website.enrich({
      websiteUrl: details.websiteUri,
      googlePlaceId: details.id,
      country,
      ...(details.internationalPhoneNumber ?? details.nationalPhoneNumber
        ? {
            googlePhone:
              details.internationalPhoneNumber ?? details.nationalPhoneNumber,
          }
        : {}),
      ...(details.displayName?.text
        ? { expectedName: details.displayName.text }
        : {}),
      ...(details.formattedAddress
        ? { expectedAddress: details.formattedAddress }
        : {}),
      ...(details.types?.[0] ? { category: details.types[0] } : {}),
    });
  }

  async scrape(input: ScrapeInput): Promise<ScraperResult> {
    const candidates = await this.search(input);
    const records: ScrapedBusiness[] = [];
    let skippedRecords = 0;
    for (const candidate of candidates) {
      const details = await this.fetchDetails(candidate);
      const normalized = await this.normalize(details);
      if (normalized) records.push(normalized);
      else skippedRecords += 1;
    }
    return {
      records,
      pagesProcessed: Math.min(
        env.GOOGLE_PLACES_MAX_PAGES_PER_JOB,
        Math.max(1, Math.ceil(candidates.length / 20)),
      ),
      skippedRecords,
      sourceKey: this.sourceKey,
    };
  }

  async healthCheck(): Promise<AdapterHealth> {
    const configuration = this.validateConfiguration();
    if (!configuration.configured) {
      return {
        status: "CONFIGURATION_MISSING",
        message: configuration.reason ?? "Provider is not configured",
      };
    }
    const startedAt = Date.now();
    try {
      await this.requestJson<GoogleTextSearchResponse>(TEXT_SEARCH_URL, {
        method: "POST",
        fieldMask: "places.id",
        body: {
          textQuery: "business in United States",
          pageSize: 1,
          regionCode: env.GOOGLE_PLACES_REGION,
          languageCode: env.GOOGLE_PLACES_LANGUAGE,
        },
      });
      return {
        status: "HEALTHY",
        message: "Google Places responded successfully",
        latencyMs: Date.now() - startedAt,
      };
    } catch (error: unknown) {
      if (error instanceof ScraperError && error.code === "API_QUOTA_EXCEEDED") {
        return {
          status: "QUOTA_LIMITED",
          message: "Google Places quota is currently unavailable",
          latencyMs: Date.now() - startedAt,
        };
      }
      return {
        status: "UNAVAILABLE",
        message: "Google Places health check failed",
        latencyMs: Date.now() - startedAt,
      };
    }
  }
}
