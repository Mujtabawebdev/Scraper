import { fetch } from "undici";

import { env } from "../../../config/env.js";
import { ScraperError } from "../errors/scraper.error.js";
import { SourceNotPermittedError } from "../errors/source-not-permitted.error.js";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export class HttpFetchService {
  private readonly approvedOrigin: string;
  private lastRequestAt = 0;

  constructor(approvedBaseUrl: string) {
    this.approvedOrigin = new URL(approvedBaseUrl).origin;
  }

  private assertApproved(url: URL): void {
    if (url.origin !== this.approvedOrigin) throw new SourceNotPermittedError();
  }

  private async waitForRateLimit(): Promise<void> {
    const wait = env.SCRAPING_MIN_DELAY_MS - (Date.now() - this.lastRequestAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastRequestAt = Date.now();
  }

  async fetchText(urlInput: string | URL, acceptedContent: RegExp): Promise<string> {
    let url = new URL(urlInput);
    this.assertApproved(url);

    for (let redirectCount = 0; redirectCount <= 3; redirectCount += 1) {
      await this.waitForRateLimit();
      const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(env.SCRAPING_REQUEST_TIMEOUT_MS),
        headers: { "user-agent": env.SCRAPING_USER_AGENT, accept: "text/html,text/plain;q=0.9" },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new ScraperError("Source redirect was invalid", "INVALID_REDIRECT");
        url = new URL(location, url);
        this.assertApproved(url);
        continue;
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
      return new TextDecoder().decode(combined);
    }
    throw new ScraperError("Source exceeded the redirect limit", "REDIRECT_LIMIT_EXCEEDED");
  }
}
