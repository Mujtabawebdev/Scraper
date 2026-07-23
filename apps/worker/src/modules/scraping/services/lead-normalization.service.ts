import { parsePhoneNumberFromString } from "libphonenumber-js";

import type { BusinessSourceType, ScrapedBusiness } from "../contracts/scraped-business.types.js";

export type NormalizedBusiness = {
  businessName: string;
  phoneRaw: string | null;
  phoneNormalized: string | null;
  phoneType: "UNKNOWN";
  email: string | null;
  website: string | null;
  domain: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string;
  category: string | null;
  sourceType: BusinessSourceType;
  sourceName: string;
  sourceUrl: string;
  sourceExternalId: string | null;
};

const normalizeSpace = (value: string | undefined): string | null => {
  const normalized = value?.trim().replace(/\s+/g, " ") ?? "";
  return normalized || null;
};

const normalizeEmail = (value: string | undefined): string | null => {
  const email = value?.trim().toLowerCase() ?? "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};

const normalizeWebsite = (value: string | undefined): { website: string | null; domain: string | null } => {
  if (!value) return { website: null, domain: null };
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return { website: null, domain: null };
    url.hash = "";
    const domain = url.hostname.toLowerCase().replace(/^www\./, "");
    return { website: url.toString(), domain };
  } catch {
    return { website: null, domain: null };
  }
};

export const normalizeBusiness = (record: ScrapedBusiness): NormalizedBusiness | null => {
  const businessName = normalizeSpace(record.businessName);
  if (!businessName) return null;

  const phoneRaw = normalizeSpace(record.phoneRaw);
  const parsedPhone = phoneRaw ? parsePhoneNumberFromString(phoneRaw, "US") : undefined;
  const phoneNormalized = parsedPhone?.isValid() ? parsedPhone.number : null;
  const state = normalizeSpace(record.state);
  const website = normalizeWebsite(record.website);

  return {
    businessName,
    phoneRaw,
    phoneNormalized,
    phoneType: "UNKNOWN",
    email: normalizeEmail(record.email),
    website: website.website,
    domain: website.domain,
    addressLine1: normalizeSpace(record.addressLine1),
    addressLine2: normalizeSpace(record.addressLine2),
    city: normalizeSpace(record.city),
    state: state?.length === 2 ? state.toUpperCase() : state,
    postalCode: normalizeSpace(record.postalCode),
    country: normalizeSpace(record.country) ?? "United States",
    category: normalizeSpace(record.category),
    sourceType: record.sourceType,
    sourceName: normalizeSpace(record.sourceName) ?? record.sourceName,
    sourceUrl: record.sourceUrl,
    sourceExternalId: normalizeSpace(record.sourceExternalId),
  };
};
