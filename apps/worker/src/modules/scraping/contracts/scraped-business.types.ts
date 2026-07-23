import type { ScrapingSourceKey } from "@lead-saas/shared-types";

export type BusinessSourceType =
  | "GOVERNMENT_DIRECTORY"
  | "BUSINESS_DIRECTORY"
  | "COMPANY_WEBSITE"
  | "LICENSED_API"
  | "USER_IMPORT"
  | "GOOGLE_PLACES_API"
  | "GOVERNMENT_DATASET"
  | "LICENSED_DATASET"
  | "CSV_IMPORT"
  | "META_APPROVED_API"
  | "YELP_APPROVED_API"
  | "OTHER";

export type ScrapedProvenance = {
  sourceKey: string;
  sourceType:
    | "FIXTURE"
    | "OFFICIAL_API"
    | "GOOGLE_PLACES_API"
    | "PUBLIC_DIRECTORY"
    | "GOVERNMENT_DATASET"
    | "OFFICIAL_WEBSITE"
    | "LICENSED_DATASET"
    | "CSV_IMPORT"
    | "META_APPROVED_API"
    | "YELP_APPROVED_API";
  sourceRecordId?: string;
  sourceUrl?: string;
  collectedAt: Date;
  extractionMethod:
    | "OFFICIAL_API"
    | "HTML_TEL_LINK"
    | "HTML_MAILTO_LINK"
    | "VISIBLE_TEXT"
    | "SCHEMA_ORG"
    | "DATASET_FIELD"
    | "CSV_COLUMN"
    | "LOCAL_REVALIDATION";
  phoneRaw?: string;
  phoneNormalized?: string;
  email?: string;
  website?: string;
  googlePlaceId?: string;
  sourceConfidenceScore: number;
  confidenceContribution: number;
  metadata?: Readonly<Record<string, string | number | boolean | null>>;
};

export type ScrapedBusiness = {
  businessName: string;
  phoneRaw?: string;
  email?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country: string;
  category?: string;
  sourceType: BusinessSourceType;
  sourceName: string;
  sourceUrl: string;
  sourceExternalId?: string;
  googlePlaceId?: string;
  officialWebsiteDomain?: string;
  confidenceHints?: {
    officialWebsite: boolean;
    schemaOrg: boolean;
    googlePhoneMatched: boolean;
    domainMatched: boolean;
    addressMatched: boolean;
  };
  provenance?: ScrapedProvenance[];
};

export type ScraperResult = {
  records: ScrapedBusiness[];
  pagesProcessed: number;
  skippedRecords: number;
  sourceKey: ScrapingSourceKey;
};
