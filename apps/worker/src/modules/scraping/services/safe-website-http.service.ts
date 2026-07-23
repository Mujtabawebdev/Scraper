import { fetch, type Response } from "undici";

import { env } from "../../../config/env.js";
import { ScraperError } from "../errors/scraper.error.js";
import {
  assertSafeWebsiteUrl,
  isSameBusinessHost,
} from "./url-safety.service.js";

const MAX_REDIRECTS = 3;
const MAX_TEMPORARY_RETRIES = 2;

export type WebsiteFetchResult = {
  text: string;
  finalUrl: URL;
};

const retryDelay = (response: Response, attempt: number): number => {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) {
      return Math.min(60_000, Math.max(0, seconds * 1_000));
    }
    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) {
      return Math.min(60_000, Math.max(0, date - Date.now()));
    }
  }
  return Math.min(5_000, 1_000 * 2 ** attempt);
};

const assertNoAccessWall = (text: string): void => {
  const sample = text.slice(0, 200_000);
  if (/(captcha|verify you are human|challenge-platform)/i.test(sample)) {
    throw new ScraperError("Source presented a CAPTCHA", "CAPTCHA_DETECTED");
  }
  if (/(sign in to continue|login required|please log in)/i.test(sample)) {
    throw new ScraperError("Source presented a login wall", "LOGIN_WALL_DETECTED");
  }
  if (/(consent required|accept cookies to continue|consent wall)/i.test(sample)) {
    throw new ScraperError("Source presented a consent wall", "CONSENT_WALL_DETECTED");
  }
  if (
    /(automated access (?:is )?(?:prohibited|not allowed)|no bots allowed)/i.test(
      sample,
    )
  ) {
    throw new ScraperError(
      "Source prohibits automated access",
      "AUTOMATED_ACCESS_NOT_ALLOWED",
    );
  }
};

const readLimitedText = async (response: Response): Promise<string> => {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > env.WEBSITE_ENRICHMENT_MAX_RESPONSE_BYTES) {
    throw new ScraperError("Source response exceeded the size limit", "RESPONSE_TOO_LARGE");
  }
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > env.WEBSITE_ENRICHMENT_MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new ScraperError(
        "Source response exceeded the size limit",
        "RESPONSE_TOO_LARGE",
      );
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(combined);
};

export class SafeWebsiteHttpService {
  private lastRequestAt = 0;

  constructor(private readonly rootUrl: URL) {}

  private async waitForDomainRateLimit(): Promise<void> {
    const wait =
      env.SCRAPING_MIN_DELAY_MS - (Date.now() - this.lastRequestAt);
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    this.lastRequestAt = Date.now();
  }

  async fetchText(
    input: URL,
    options: { allowNotFound?: boolean } = {},
  ): Promise<WebsiteFetchResult | null> {
    let url = await assertSafeWebsiteUrl(input);
    if (!isSameBusinessHost(url, this.rootUrl)) {
      throw new ScraperError("Cross-domain website request rejected", "UNSAFE_URL");
    }

    for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
      // DNS is resolved and checked again before every network request and
      // every redirect, reducing DNS-rebinding and redirect-to-private-host risk.
      url = await assertSafeWebsiteUrl(url);
      let response: Response | undefined;
      for (let attempt = 0; attempt <= MAX_TEMPORARY_RETRIES; attempt += 1) {
        await this.waitForDomainRateLimit();
        response = await fetch(url, {
          redirect: "manual",
          signal: AbortSignal.timeout(env.SCRAPING_REQUEST_TIMEOUT_MS),
          headers: {
            "user-agent": env.SCRAPING_USER_AGENT,
            accept: "text/html,text/plain;q=0.9",
          },
        });
        if (response.status === 401) {
          throw new ScraperError("Source requires authorization", "SOURCE_AUTHORIZATION_DENIED");
        }
        if (response.status === 403) {
          throw new ScraperError("Source denied access", "SOURCE_ACCESS_FORBIDDEN");
        }
        if (
          (response.status === 429 || response.status >= 500) &&
          attempt < MAX_TEMPORARY_RETRIES
        ) {
          const delay = retryDelay(response, attempt);
          await response.body?.cancel();
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        break;
      }
      if (!response) {
        throw new ScraperError("Source request failed", "SOURCE_REQUEST_FAILED");
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) {
          throw new ScraperError("Source redirect was invalid", "INVALID_REDIRECT");
        }
        const destination = await assertSafeWebsiteUrl(new URL(location, url));
        if (!isSameBusinessHost(destination, this.rootUrl)) {
          throw new ScraperError("Cross-domain redirect rejected", "UNSAFE_URL");
        }
        url = destination;
        continue;
      }
      if (response.status === 404 && options.allowNotFound) {
        await response.body?.cancel();
        return null;
      }
      if (response.status === 429) {
        throw new ScraperError("Source rate limit remained active", "SOURCE_RATE_LIMITED");
      }
      if (!response.ok) {
        throw new ScraperError("Source request was not successful", "SOURCE_REQUEST_FAILED");
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!/^text\/(?:html|plain)(?:;|$)/i.test(contentType)) {
        throw new ScraperError(
          "Source content type is not permitted",
          "INVALID_CONTENT_TYPE",
        );
      }
      const text = await readLimitedText(response);
      assertNoAccessWall(text);
      return { text, finalUrl: url };
    }
    throw new ScraperError("Source exceeded the redirect limit", "REDIRECT_LIMIT_EXCEEDED");
  }
}
