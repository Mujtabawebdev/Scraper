import { fetch, type Response } from "undici";

import { env } from "../../../config/env.js";
import { ScraperError } from "../errors/scraper.error.js";
import { SourceNotPermittedError } from "../errors/source-not-permitted.error.js";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_TEMPORARY_RETRIES = 2;

type RateLimitPolicy = {
  requestsPerMinute: number;
  maxConcurrency: number;
};

export class HttpFetchService {
  private readonly approvedOrigin: string;
  private lastRequestAt = 0;
  private activeRequests = 0;
  private rateLimitPolicy: RateLimitPolicy = {
    requestsPerMinute: 10,
    maxConcurrency: 1,
  };

  constructor(approvedBaseUrl: string) {
    this.approvedOrigin = new URL(approvedBaseUrl).origin;
  }

  private assertApproved(url: URL): void {
    if (url.origin !== this.approvedOrigin) throw new SourceNotPermittedError();
  }

  setRateLimitPolicy(policy: RateLimitPolicy): void {
    this.rateLimitPolicy = {
      requestsPerMinute: Math.min(120, Math.max(1, policy.requestsPerMinute)),
      maxConcurrency: Math.min(10, Math.max(1, policy.maxConcurrency)),
    };
  }

  private async acquireRequestSlot(): Promise<void> {
    while (this.activeRequests >= this.rateLimitPolicy.maxConcurrency) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    this.activeRequests += 1;
  }

  private releaseRequestSlot(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  private async waitForRateLimit(): Promise<void> {
    const policyDelay = Math.ceil(
      60_000 / this.rateLimitPolicy.requestsPerMinute,
    );
    const minimumDelay = Math.max(env.SCRAPING_MIN_DELAY_MS, policyDelay);
    const wait = minimumDelay - (Date.now() - this.lastRequestAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequestAt = Date.now();
  }

  private retryDelay(response: Response, attempt: number): number {
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
  }

  private assertNoPolicyWall(text: string): void {
    const sample = text.slice(0, 200_000);
    if (/(captcha|verify you are human|challenge-platform)/i.test(sample)) {
      throw new ScraperError("Source presented a CAPTCHA", "CAPTCHA_DETECTED");
    }
    if (/(sign in to continue|login required|please log in)/i.test(sample)) {
      throw new ScraperError("Source presented a login wall", "LOGIN_WALL");
    }
    if (/(consent required|accept cookies to continue|consent wall)/i.test(sample)) {
      throw new ScraperError("Source presented a consent wall", "CONSENT_WALL");
    }
    if (
      /(automated access (?:is )?(?:prohibited|not allowed)|no bots allowed)/i.test(
        sample,
      )
    ) {
      throw new ScraperError(
        "Source prohibits automated access",
        "AUTOMATION_PROHIBITED",
      );
    }
  }

  async fetchText(urlInput: string | URL, acceptedContent: RegExp): Promise<string> {
    let url = new URL(urlInput);
    this.assertApproved(url);

    for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
      let response: Response | undefined;
      for (let attempt = 0; attempt <= MAX_TEMPORARY_RETRIES; attempt += 1) {
        await this.acquireRequestSlot();
        try {
          await this.waitForRateLimit();
          response = await fetch(url, {
            redirect: "manual",
            signal: AbortSignal.timeout(env.SCRAPING_REQUEST_TIMEOUT_MS),
            headers: {
              "user-agent": env.SCRAPING_USER_AGENT,
              accept: "text/html,text/plain;q=0.9",
            },
          });
        } finally {
          this.releaseRequestSlot();
        }
        const currentResponse = response;
        if (!currentResponse) continue;
        if (
          currentResponse.status === 401 ||
          currentResponse.status === 403
        ) {
          throw new ScraperError(
            "Source denied authorization",
            "SOURCE_AUTHORIZATION_DENIED",
          );
        }
        if (
          (currentResponse.status === 429 || currentResponse.status >= 500) &&
          attempt < MAX_TEMPORARY_RETRIES
        ) {
          const delay = this.retryDelay(currentResponse, attempt);
          await currentResponse.body?.cancel();
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        break;
      }
      if (!response) {
        throw new ScraperError(
          "Source request was not successful",
          "SOURCE_REQUEST_FAILED",
        );
      }
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new ScraperError("Source redirect was invalid", "INVALID_REDIRECT");
        url = new URL(location, url);
        this.assertApproved(url);
        continue;
      }
      if (response.status === 429) {
        throw new ScraperError(
          "Source rate limit remained active",
          "RATE_LIMIT_REJECTED",
        );
      }
      if (!response.ok) throw new ScraperError("Source request was not successful", "SOURCE_REQUEST_FAILED");
      const contentType = response.headers.get("content-type") ?? "";
      if (!acceptedContent.test(contentType)) throw new ScraperError("Source content type is not permitted", "INVALID_CONTENT_TYPE");
      const declaredSize = Number(response.headers.get("content-length") ?? "0");
      if (declaredSize > MAX_RESPONSE_BYTES) throw new ScraperError("Source response exceeded the size limit", "RESPONSE_TOO_LARGE");
      const reader = response.body?.getReader();
      if (!reader) return "";
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > MAX_RESPONSE_BYTES) {
          await reader.cancel();
          throw new ScraperError("Source response exceeded the size limit", "RESPONSE_TOO_LARGE");
        }
        chunks.push(value);
      }
      const combined = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const text = new TextDecoder().decode(combined);
      this.assertNoPolicyWall(text);
      return text;
    }
    throw new ScraperError("Source exceeded the redirect limit", "REDIRECT_LIMIT_EXCEEDED");
  }
}
