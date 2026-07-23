import type { LeadDetail, LeadSummary } from "@lead-saas/shared-types";

import type {
  LeadDetailRecord,
  LeadSummaryRecord,
} from "./lead.repository.js";

export const mapLeadSummary = (lead: LeadSummaryRecord): LeadSummary => ({
  id: lead.id,
  businessName: lead.businessName,
  phone: lead.phoneRaw,
  email: lead.email,
  website: lead.website,
  category: lead.category,
  city: lead.city,
  state: lead.state,
  source: lead.scrapingJob.source,
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
  };
};
