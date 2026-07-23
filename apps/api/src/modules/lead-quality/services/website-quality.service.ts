import { URL } from "url";

export type WebsiteValidationResult = {
  isValidUrl: boolean;
  normalizedUrl: string | null; // e.g. https://acme.com
  domain: string | null; // e.g. acme.com
  registeredDomain: string | null; // public-suffix-aware base domain
  isPrivateNetwork: boolean;
  scheme: string | null;
  status: "VALID_URL" | "INVALID_SCHEME" | "PRIVATE_NETWORK" | "UNAVAILABLE" | "INVALID" | "NO_WEBSITE_FOUND";
  isAvailable: boolean | null;
  failureReason: string | null;
};

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^0\./,
  /^::1$/,
  /^fe80:/i,
  /^fc00:/i,
  /localhost/i,
];

export class WebsiteQualityService {
  /**
   * Normalize and validate website URL deterministically without network calls.
   */
  public validateWebsiteLocal(urlInput: string | null | undefined): WebsiteValidationResult {
    if (!urlInput || !urlInput.trim()) {
      return {
        isValidUrl: false,
        normalizedUrl: null,
        domain: null,
        registeredDomain: null,
        isPrivateNetwork: false,
        scheme: null,
        status: "NO_WEBSITE_FOUND",
        isAvailable: null,
        failureReason: "Website URL is missing",
      };
    }

    let trimmed = urlInput.trim();
    if (!/^https?:\/\//i.test(trimmed)) {
      trimmed = `https://${trimmed}`;
    }

    try {
      const parsed = new URL(trimmed);
      const scheme = parsed.protocol.replace(":", "").toLowerCase();

      if (scheme !== "http" && scheme !== "https") {
        return {
          isValidUrl: false,
          normalizedUrl: null,
          domain: null,
          registeredDomain: null,
          isPrivateNetwork: false,
          scheme,
          status: "INVALID_SCHEME",
          isAvailable: null,
          failureReason: `Unsupported URL scheme: ${scheme}. Only HTTP and HTTPS are permitted.`,
        };
      }

      const hostname = parsed.hostname.toLowerCase();

      // Private IP / localhost check
      for (const pattern of PRIVATE_IP_PATTERNS) {
        if (pattern.test(hostname)) {
          return {
            isValidUrl: false,
            normalizedUrl: null,
            domain: hostname,
            registeredDomain: null,
            isPrivateNetwork: true,
            scheme,
            status: "PRIVATE_NETWORK",
            isAvailable: false,
            failureReason: "Private IP addresses and localhost URLs are prohibited",
          };
        }
      }

      // Domain normalization (strip www. for base domain comparison)
      const domainWithoutWww = hostname.replace(/^www\./, "");
      const registeredDomain = this.extractRegisteredDomain(domainWithoutWww);

      const normalizedUrl = `https://${hostname}${parsed.pathname === "/" ? "" : parsed.pathname}${parsed.search}`;

      return {
        isValidUrl: true,
        normalizedUrl,
        domain: domainWithoutWww,
        registeredDomain,
        isPrivateNetwork: false,
        scheme,
        status: "VALID_URL",
        isAvailable: null,
        failureReason: null,
      };
    } catch {
      return {
        isValidUrl: false,
        normalizedUrl: null,
        domain: null,
        registeredDomain: null,
        isPrivateNetwork: false,
        scheme: null,
        isAvailable: null,
        status: "INVALID",
        failureReason: "Malformed website URL",
      };
    }
  }

  /**
   * Lightweight public website availability check with strict timeouts & limits.
   */
  public async checkAvailability(url: string): Promise<{ isAvailable: boolean; statusCode: number | null }> {
    const local = this.validateWebsiteLocal(url);
    if (!local.isValidUrl || local.isPrivateNetwork) {
      return { isAvailable: false, statusCode: null };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(local.normalizedUrl!, {
        method: "HEAD",
        signal: controller.signal,
        headers: {
          "User-Agent": "AntigravityLeadQualityBot/1.0 (+https://example.com/bot-policy)",
        },
        redirect: "follow",
      });

      clearTimeout(timeoutId);
      return {
        isAvailable: response.status >= 200 && response.status < 400,
        statusCode: response.status,
      };
    } catch {
      return { isAvailable: false, statusCode: null };
    }
  }

  /**
   * Simple public-suffix-aware base domain extractor (e.g. acme.co.uk -> acme.co.uk, www.acme.com -> acme.com).
   */
  public extractRegisteredDomain(domain: string): string {
    const clean = domain.toLowerCase().replace(/^www\./, "");
    const parts = clean.split(".");
    if (parts.length <= 2) return clean;

    const twoPartTlds = new Set(["co.uk", "com.au", "co.nz", "org.uk", "gov.uk", "ac.uk", "com.br", "co.jp"]);
    const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;

    if (twoPartTlds.has(lastTwo) && parts.length >= 3) {
      return `${parts[parts.length - 3]}.${lastTwo}`;
    }

    return `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  }
}

export const websiteQualityService = new WebsiteQualityService();
