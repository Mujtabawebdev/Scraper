import { createRequire } from "node:module";
import type { Robot } from "robots-parser";

import { env } from "../../../config/env.js";
import { RobotsDisallowedError } from "../errors/robots-disallowed.error.js";
import type { HttpFetchService } from "./http-fetch.service.js";

type CachedPolicy = { policy: Robot; expiresAt: number };
const require = createRequire(import.meta.url);
const robotsParser: typeof import("robots-parser").default = require("robots-parser");

export class RobotsPolicyService {
  private cachedPolicy: CachedPolicy | undefined;

  constructor(
    private readonly baseUrl: URL,
    private readonly http: HttpFetchService,
  ) {}

  async assertAllowed(url: URL): Promise<void> {
    if (!this.cachedPolicy || this.cachedPolicy.expiresAt <= Date.now()) {
      const robotsUrl = new URL("/robots.txt", this.baseUrl);
      const text = await this.http.fetchText(robotsUrl, /^text\/plain(?:;|$)/i);
      this.cachedPolicy = {
        policy: robotsParser(robotsUrl.toString(), text),
        expiresAt: Date.now() + 10 * 60 * 1_000,
      };
    }
    if (this.cachedPolicy.policy.isAllowed(url.toString(), env.SCRAPING_USER_AGENT) !== true) {
      throw new RobotsDisallowedError();
    }
  }
}
