import type { Prisma } from "@lead-saas/api/prisma-client";

import { prisma } from "../../../infrastructure/database/prisma.js";
import type {
  NormalizedBusiness,
  NormalizedProvenance,
} from "./lead-normalization.service.js";

const PROGRESS_BATCH_SIZE = 10;

export type LeadPersistenceProgress = {
  completed: number;
  total: number;
  successCount: number;
  duplicateCount: number;
};

export type LeadPersistenceOptions = {
  scrapingJobId: string;
  userId: string;
  sourceKey?: string;
  shouldCancel?: () => Promise<boolean>;
  onProgress?: (progress: LeadPersistenceProgress) => Promise<boolean | void>;
};

export type LeadPersistenceResult = {
  successCount: number;
  duplicateCount: number;
  cancelled: boolean;
};

type ExistingLead = {
  id: string;
  scrapingJobId: string;
  confidenceScore: number;
};

const findExistingLead = async (
  transaction: Prisma.TransactionClient,
  record: NormalizedBusiness,
  userId: string,
): Promise<ExistingLead | null> => {
  const select = {
    id: true,
    scrapingJobId: true,
    confidenceScore: true,
  } as const;
  if (record.googlePlaceId) {
    const match = await transaction.lead.findFirst({
      where: { userId, googlePlaceId: record.googlePlaceId },
      select,
    });
    if (match) return match;
  }
  if (record.sourceExternalId) {
    const match = await transaction.lead.findFirst({
      where: {
        userId,
        sourceType: record.sourceType,
        sourceName: { equals: record.sourceName, mode: "insensitive" },
        sourceExternalId: record.sourceExternalId,
      },
      select,
    });
    if (match) return match;
  }
  if (record.domain && record.city) {
    const match = await transaction.lead.findFirst({
      where: {
        userId,
        domain: record.domain,
        businessName: { equals: record.businessName, mode: "insensitive" },
        city: { equals: record.city, mode: "insensitive" },
      },
      select,
    });
    if (match) return match;
  }
  if (record.phoneNormalized) {
    const match = await transaction.lead.findFirst({
      where: {
        userId,
        phoneNormalized: record.phoneNormalized,
        businessName: { equals: record.businessName, mode: "insensitive" },
      },
      select,
    });
    if (match) return match;
  }
  if (record.addressLine1 && record.postalCode) {
    const match = await transaction.lead.findFirst({
      where: {
        userId,
        businessName: { equals: record.businessName, mode: "insensitive" },
        addressLine1: { equals: record.addressLine1, mode: "insensitive" },
        postalCode: record.postalCode,
      },
      select,
    });
    return match;
  }
  return null;
};

const approvedTypeForRecord = (
  record: NormalizedBusiness,
):
  | "FIXTURE"
  | "OFFICIAL_API"
  | "GOOGLE_PLACES_API"
  | "PUBLIC_DIRECTORY"
  | "GOVERNMENT_DATASET"
  | "OFFICIAL_WEBSITE"
  | "LICENSED_DATASET"
  | "CSV_IMPORT"
  | "META_APPROVED_API"
  | "YELP_APPROVED_API" => {
  switch (record.sourceType) {
    case "GOOGLE_PLACES_API":
      return "GOOGLE_PLACES_API";
    case "GOVERNMENT_DATASET":
    case "GOVERNMENT_DIRECTORY":
      return "GOVERNMENT_DATASET";
    case "LICENSED_DATASET":
      return "LICENSED_DATASET";
    case "CSV_IMPORT":
    case "USER_IMPORT":
      return "CSV_IMPORT";
    case "META_APPROVED_API":
      return "META_APPROVED_API";
    case "YELP_APPROVED_API":
      return "YELP_APPROVED_API";
    case "COMPANY_WEBSITE":
      return "OFFICIAL_WEBSITE";
    case "BUSINESS_DIRECTORY":
      return "PUBLIC_DIRECTORY";
    case "LICENSED_API":
    case "OTHER":
      return "OFFICIAL_API";
  }
};

const persistProvenance = async (
  transaction: Prisma.TransactionClient,
  leadId: string,
  record: NormalizedBusiness,
  sourceKey: string,
): Promise<void> => {
  const defaultSourceKey =
    sourceKey === "fixture-directory" ? "fixture-business-directory" : sourceKey;
  const items: NormalizedProvenance[] =
    (record.provenance?.length ?? 0) > 0
      ? (record.provenance ?? [])
      : [
          {
            sourceKey: defaultSourceKey,
            sourceType:
              defaultSourceKey === "fixture-business-directory"
                ? ("FIXTURE" as const)
                : approvedTypeForRecord(record),
            sourceUrl: record.sourceUrl,
            collectedAt: new Date(),
            extractionMethod:
              record.sourceType === "COMPANY_WEBSITE"
                ? ("VISIBLE_TEXT" as const)
                : ("DATASET_FIELD" as const),
            phoneRaw: record.phoneRaw,
            phoneNormalized: record.phoneNormalized,
            verificationStatus:
              record.phoneValidationStatus ?? "UNVERIFIED",
            sourceConfidenceScore: record.confidenceScore ?? 0,
            confidenceContribution: record.confidenceScore ?? 0,
            ...(record.sourceExternalId
              ? { sourceRecordId: record.sourceExternalId }
              : {}),
            ...(record.email ? { email: record.email } : {}),
            ...(record.website ? { website: record.website } : {}),
            ...(record.googlePlaceId
              ? { googlePlaceId: record.googlePlaceId }
              : {}),
          },
        ];

  for (const item of items) {
    const approvedKey =
      item.sourceKey === "fixture-directory"
        ? "fixture-business-directory"
        : item.sourceKey;
    const source = await transaction.approvedSource.findUnique({
      where: { key: approvedKey },
      select: { id: true },
    });
    const alreadyRecorded = await transaction.leadProvenance.findFirst({
      where: {
        leadId,
        sourceKey: approvedKey,
        sourceRecordId: item.sourceRecordId ?? null,
        extractionMethod: item.extractionMethod,
        phoneNormalized: item.phoneNormalized ?? null,
      },
      select: { id: true },
    });
    if (alreadyRecorded) continue;
    await transaction.leadProvenance.create({
      data: {
        leadId,
        approvedSourceId: source?.id ?? null,
        sourceKey: approvedKey,
        sourceType: item.sourceType,
        sourceRecordId: item.sourceRecordId ?? null,
        sourceUrl: item.sourceUrl ?? null,
        sourceCollectedAt: item.collectedAt,
        sourceLastCheckedAt: item.collectedAt,
        sourceConfidenceScore: Math.min(
          100,
          Math.max(0, item.sourceConfidenceScore),
        ),
        verificationStatus: item.verificationStatus,
        extractionMethod: item.extractionMethod,
        phoneRaw: item.phoneRaw,
        phoneNormalized: item.phoneNormalized,
        email: item.email ?? null,
        website: item.website ?? null,
        googlePlaceId: item.googlePlaceId ?? null,
        confidenceContribution: Math.min(
          100,
          Math.max(-100, item.confidenceContribution),
        ),
        ...(item.metadata
          ? { rawSourceMetadata: { ...item.metadata } }
          : {}),
      },
    });
  }
};

export const persistLeads = async (
  records: NormalizedBusiness[],
  options: LeadPersistenceOptions,
): Promise<LeadPersistenceResult> => {
  let successCount = 0;
  let duplicateCount = 0;

  for (const [index, record] of records.entries()) {
    if (options.shouldCancel && (await options.shouldCancel())) {
      return { successCount, duplicateCount, cancelled: true };
    }

    const outcome = await prisma.$transaction(async (transaction) => {
      // Every worker process participates in this database-backed critical
      // section. The lock is scoped to this transaction and its user, so the
      // matching lookup and insert cannot race another job for the same tenant.
      await transaction.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtextextended(${options.userId}, 0))
      `;

      const existing = await findExistingLead(
        transaction,
        record,
        options.userId,
      );
      if (existing) {
        await persistProvenance(
          transaction,
          existing.id,
          record,
          options.sourceKey ?? "permitted-http-directory",
        );
        if ((record.confidenceScore ?? 0) > existing.confidenceScore) {
          await transaction.lead.update({
            where: { id: existing.id },
            data: {
              phoneRaw: record.phoneRaw,
              phoneNormalized: record.phoneNormalized,
              phoneExtension: record.phoneExtension ?? null,
              phoneCountryCode: record.phoneCountryCode ?? null,
              phoneNationalFormat: record.phoneNationalFormat ?? null,
              phoneType: record.phoneType,
              phoneValidationStatus:
                record.phoneValidationStatus ?? "UNVERIFIED",
              email: record.email,
              website: record.website,
              domain: record.domain,
              officialWebsiteDomain: record.officialWebsiteDomain ?? null,
              confidenceScore: record.confidenceScore ?? 0,
              confidenceLevel: record.confidenceLevel ?? "VERY_LOW",
              lastVerifiedAt: new Date(),
            },
          });
        }
        return existing.scrapingJobId === options.scrapingJobId
          ? "SUCCESS"
          : "DUPLICATE";
      }

      const lead = await transaction.lead.create({
        data: {
          businessName: record.businessName,
          phoneRaw: record.phoneRaw,
          phoneNormalized: record.phoneNormalized,
          phoneExtension: record.phoneExtension ?? null,
          phoneCountryCode: record.phoneCountryCode ?? null,
          phoneNationalFormat: record.phoneNationalFormat ?? null,
          phoneType: record.phoneType,
          phoneValidationStatus:
            record.phoneValidationStatus ?? "UNVERIFIED",
          email: record.email,
          website: record.website,
          domain: record.domain,
          addressLine1: record.addressLine1,
          addressLine2: record.addressLine2,
          city: record.city,
          state: record.state,
          postalCode: record.postalCode,
          country: record.country,
          category: record.category,
          sourceType: record.sourceType,
          sourceName: record.sourceName,
          sourceUrl: record.sourceUrl,
          sourceExternalId: record.sourceExternalId,
          googlePlaceId: record.googlePlaceId ?? null,
          officialWebsiteDomain: record.officialWebsiteDomain ?? null,
          confidenceScore: record.confidenceScore ?? 0,
          confidenceLevel: record.confidenceLevel ?? "VERY_LOW",
          status: "NEW",
          isPublicBusinessContact: true,
          collectedAt: new Date(),
          userId: options.userId,
          scrapingJobId: options.scrapingJobId,
        },
        select: { id: true },
      });
      await persistProvenance(
        transaction,
        lead.id,
        record,
        options.sourceKey ?? "permitted-http-directory",
      );
      return "SUCCESS";
    });

    if (outcome === "SUCCESS") successCount += 1;
    else duplicateCount += 1;

    const completed = index + 1;
    const shouldPublishProgress =
      completed === records.length || completed % PROGRESS_BATCH_SIZE === 0;
    if (options.onProgress && shouldPublishProgress) {
      const shouldContinue = await options.onProgress({
        completed,
        total: records.length,
        successCount,
        duplicateCount,
      });
      if (shouldContinue === false) {
        return { successCount, duplicateCount, cancelled: true };
      }
    }
  }

  return { successCount, duplicateCount, cancelled: false };
};
