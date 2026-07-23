import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { ScraperError } from "../errors/scraper.error.js";

const blockedHostnames = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
]);

const parseIpv4 = (address: string): number[] | null => {
  if (isIP(address) !== 4) return null;
  const parts = address.split(".").map(Number);
  return parts.length === 4 ? parts : null;
};

export const isPrivateOrReservedIp = (address: string): boolean => {
  const ipv4 = parseIpv4(address.replace(/^::ffff:/i, ""));
  if (ipv4) {
    const [a = 0, b = 0] = ipv4;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized) ||
      normalized.startsWith("ff")
    );
  }
  return true;
};

export const assertSafeWebsiteUrl = async (
  input: string | URL,
): Promise<URL> => {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ScraperError("Website URL is invalid", "UNSAFE_URL");
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password
  ) {
    throw new ScraperError("Website URL is not permitted", "UNSAFE_URL");
  }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    blockedHostnames.has(hostname) ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new ScraperError("Website host is not public", "UNSAFE_URL");
  }
  if (isIP(hostname) && isPrivateOrReservedIp(hostname)) {
    throw new ScraperError("Website address is not public", "UNSAFE_URL");
  }
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new ScraperError("Website DNS lookup failed", "UNSAFE_URL");
  }
  if (
    addresses.length === 0 ||
    addresses.some((entry) => isPrivateOrReservedIp(entry.address))
  ) {
    throw new ScraperError("Website resolved to a non-public address", "UNSAFE_URL");
  }
  return url;
};

export const isSameBusinessHost = (candidate: URL, root: URL): boolean => {
  const clean = (host: string) => host.toLowerCase().replace(/^www\./, "");
  return clean(candidate.hostname) === clean(root.hostname);
};
