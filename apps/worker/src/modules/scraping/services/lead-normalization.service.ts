import type {
  BusinessSourceType,
  ScrapedBusiness,
  ScrapedProvenance,
} from "../contracts/scraped-business.types.js";
import { scoreConfidence } from "./confidence-scoring.service.js";
import { normalizePhone } from "./phone-normalization.service.js";

export type NormalizedProvenance = Omit<
  ScrapedProvenance,
  "phoneRaw" | "phoneNormalized"
> & {
  phoneRaw: string | null;
  phoneNormalized: string | null;
  verificationStatus:
    | "VALID"
    | "POSSIBLE"
    | "INVALID"
    | "PLACEHOLDER"
    | "UNVERIFIED"
    | "NO_PHONE_FOUND";
};

export type NormalizedBusiness = {
  businessName: string;
  phoneRaw: string | null;
  phoneNormalized: string | null;
  phoneExtension?: string | null;
  phoneCountryCode?: string | null;
  phoneNationalFormat?: string | null;
  phoneType: "LANDLINE" | "MOBILE" | "VOIP" | "TOLL_FREE" | "UNKNOWN";
  phoneValidationStatus?:
    | "VALID"
    | "POSSIBLE"
    | "INVALID"
    | "PLACEHOLDER"
    | "UNVERIFIED"
    | "NO_PHONE_FOUND";
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
  googlePlaceId?: string | null;
  officialWebsiteDomain?: string | null;
  confidenceScore?: number;
  confidenceLevel?: "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";
  provenance?: NormalizedProvenance[];
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

  const phone = normalizePhone(record.phoneRaw);
  const state = normalizeSpace(record.state);
  const website = normalizeWebsite(record.website);
  const provenance: NormalizedProvenance[] = (record.provenance ?? []).map(
    (item) => {
      const sourcePhone = normalizePhone(item.phoneRaw);
      return {
        ...item,
        phoneRaw: sourcePhone.raw,
        phoneNormalized: sourcePhone.e164,
        verificationStatus: sourcePhone.validationStatus,
      };
    },
  );
  const hints = record.confidenceHints ?? {
    officialWebsite: record.sourceType === "COMPANY_WEBSITE",
    schemaOrg: false,
    googlePhoneMatched: false,
    domainMatched: Boolean(website.domain),
    addressMatched: false,
  };
  const confidence = scoreConfidence({
    ...hints,
    validPhone: phone.validationStatus === "VALID",
    sourceCount: Math.max(1, provenance.length),
    conflictingPhones:
      new Set(
        provenance
          .map((item) => item.phoneNormalized)
          .filter((value): value is string => Boolean(value)),
      ).size > 1,
    placeholderOrInvalid:
      phone.validationStatus === "PLACEHOLDER" ||
      phone.validationStatus === "INVALID",
    recentlyChecked: true,
  });

  return {
    businessName,
    phoneRaw: phone.raw,
    phoneNormalized: phone.e164,
    phoneExtension: phone.extension,
    phoneCountryCode: phone.countryCode,
    phoneNationalFormat: phone.nationalFormat,
    phoneType: phone.phoneType,
    phoneValidationStatus: phone.validationStatus,
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
    googlePlaceId: normalizeSpace(record.googlePlaceId),
    officialWebsiteDomain:
      normalizeSpace(record.officialWebsiteDomain) ?? website.domain,
    confidenceScore: confidence.score,
    confidenceLevel: confidence.level,
    provenance,
  };
};
