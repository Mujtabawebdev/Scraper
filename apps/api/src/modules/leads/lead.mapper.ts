import type { LeadDetail, LeadSummary } from "@lead-saas/shared-types";

import type {
  LeadDetailRecord,
  LeadSummaryRecord,
} from "./lead.repository.js";

export const mapLeadSummary = (lead: LeadSummaryRecord): LeadSummary => ({
  id: lead.id,
  businessName: lead.businessName,
  phone: lead.phoneRaw,
  normalizedPhone: lead.phoneNormalized ?? null,
  phoneExtension: lead.phoneExtension ?? null,
  phoneCountryCode: lead.phoneCountryCode ?? null,
  phoneNationalFormat: lead.phoneNationalFormat ?? null,
  phoneType: lead.phoneType ?? "UNKNOWN",
  phoneValidationStatus: lead.phoneValidationStatus ?? "UNVERIFIED",
  email: lead.email,
  website: lead.website,
  category: lead.category,
  city: lead.city,
  state: lead.state,
  source: lead.scrapingJob.source,
  sourceType: lead.sourceType ?? "OTHER",
  confidenceScore: lead.confidenceScore ?? 0,
  confidenceLevel: lead.confidenceLevel ?? "VERY_LOW",
  lastVerifiedAt: lead.lastVerifiedAt?.toISOString() ?? null,
  provenanceCount: lead._count?.provenance ?? 0,
  createdAt: lead.createdAt.toISOString(),
});

export const mapLeadDetail = (lead: LeadDetailRecord): LeadDetail => {
  const address = [lead.addressLine1, lead.addressLine2]
    .filter((value): value is string => Boolean(value))
    .join(", ");
  return {
    ...mapLeadSummary(lead),
    address: address || null,
    postalCode: lead.postalCode,
    country: lead.country,
    sourceUrl: lead.sourceUrl,
    scrapingJobId: lead.scrapingJobId,
    updatedAt: lead.updatedAt.toISOString(),
    googlePlaceId: lead.googlePlaceId ?? null,
    officialWebsiteDomain: lead.officialWebsiteDomain ?? null,
  };
};
