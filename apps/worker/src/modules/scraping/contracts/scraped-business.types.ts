import type { ScrapingSourceKey } from "@lead-saas/shared-types";

export type BusinessSourceType =
  | "GOVERNMENT_DIRECTORY"
  | "BUSINESS_DIRECTORY"
  | "COMPANY_WEBSITE"
  | "LICENSED_API"
  | "USER_IMPORT"
  | "OTHER";

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
};

export type ScraperResult = {
  records: ScrapedBusiness[];
  pagesProcessed: number;
  skippedRecords: number;
  sourceKey: ScrapingSourceKey;
};
