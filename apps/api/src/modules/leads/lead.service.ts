import { createPaginationMetadata } from "../scraping-jobs/scraping-job.mapper.js";
import {
  leadNotFoundError,
  leadProvenanceNotFoundError,
  phoneInvalidError,
  phoneNotFoundError,
} from "./lead.errors.js";
import { mapLeadDetail, mapLeadSummary } from "./lead.mapper.js";
import {
  findOwnedLeadDetail,
  findOwnedLeadForVerification,
  listOwnedLeadProvenance,
  updateOwnedLeadPhoneVerification,
  listOwnedLeads,
} from "./lead.repository.js";
import type { ListLeadsQuery } from "./lead.types.js";
import { validateLeadPhone } from "./lead-phone.service.js";

export const listLeads = async (userId: string, query: ListLeadsQuery) => {
  const result = await listOwnedLeads(userId, query);
  return {
    leads: result.leads.map(mapLeadSummary),
    pagination: createPaginationMetadata(
      query.page,
      query.pageSize,
      result.totalItems,
    ),
  };
};

export const getLead = async (userId: string, leadId: string) => {
  const lead = await findOwnedLeadDetail(leadId, userId);
  if (!lead) throw leadNotFoundError();
  return mapLeadDetail(lead);
};

const confidenceLevel = (
  score: number,
): "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW" =>
  score >= 90 ? "HIGH" : score >= 70 ? "MEDIUM" : score >= 40 ? "LOW" : "VERY_LOW";

export const verifyLead = async (userId: string, leadId: string) => {
  const lead = await findOwnedLeadForVerification(leadId, userId);
  if (!lead) throw leadNotFoundError();
  const validation = validateLeadPhone(lead.phoneRaw);
  if (validation.phoneValidationStatus === "NO_PHONE_FOUND") {
    throw phoneNotFoundError();
  }
  const confidenceScore = Math.min(
    100,
    Math.max(
      0,
      lead.confidenceScore +
        (validation.phoneValidationStatus === "VALID" ? 10 : -25),
    ),
  );
  const updated = await updateOwnedLeadPhoneVerification(leadId, userId, {
    phoneNormalized: validation.normalizedPhone,
    phoneExtension: validation.phoneExtension,
    phoneCountryCode: validation.phoneCountryCode,
    phoneNationalFormat: validation.phoneNationalFormat,
    phoneType: validation.phoneType,
    phoneValidationStatus: validation.phoneValidationStatus,
    confidenceScore,
    confidenceLevel: confidenceLevel(confidenceScore),
  });
  if (!updated) throw leadNotFoundError();
  if (
    validation.phoneValidationStatus === "INVALID" ||
    validation.phoneValidationStatus === "PLACEHOLDER"
  ) {
    throw phoneInvalidError();
  }
  return getLead(userId, leadId);
};

const safeSourceUrl = (value: string | null): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.username = "";
    url.password = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/(?:api.?key|token|secret|signature|credential)/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return null;
  }
};

export const getLeadProvenance = async (
  userId: string,
  leadId: string,
) => {
  const lead = await findOwnedLeadForVerification(leadId, userId);
  if (!lead) throw leadNotFoundError();
  const records = await listOwnedLeadProvenance(leadId, userId);
  if (records.length === 0) throw leadProvenanceNotFoundError();
  return records.map((record) => ({
    id: record.id,
    sourceKey: record.sourceKey,
    sourceName: record.approvedSource?.displayName ?? record.sourceKey,
    sourceType: record.sourceType,
    sourceRecordId: record.sourceRecordId,
    sourceUrl: safeSourceUrl(record.sourceUrl),
    sourceCollectedAt: record.sourceCollectedAt.toISOString(),
    sourceLastCheckedAt: record.sourceLastCheckedAt?.toISOString() ?? null,
    sourceConfidenceScore: record.sourceConfidenceScore,
    verificationStatus: record.verificationStatus,
    extractionMethod: record.extractionMethod,
    phone: record.phoneRaw,
    normalizedPhone: record.phoneNormalized,
    email: record.email,
    website: safeSourceUrl(record.website),
    googlePlaceId: record.googlePlaceId,
    confidenceContribution: record.confidenceContribution,
  }));
};
