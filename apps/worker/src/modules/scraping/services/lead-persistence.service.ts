import type { Prisma } from "@lead-saas/api/prisma-client";

import { prisma } from "../../../infrastructure/database/prisma.js";
import type { NormalizedBusiness } from "./lead-normalization.service.js";

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
  shouldCancel?: () => Promise<boolean>;
  onProgress?: (progress: LeadPersistenceProgress) => Promise<boolean | void>;
};

export type LeadPersistenceResult = {
  successCount: number;
  duplicateCount: number;
  cancelled: boolean;
};

const findExistingJobId = async (
  transaction: Prisma.TransactionClient,
  record: NormalizedBusiness,
  userId: string,
): Promise<string | null> => {
  if (record.sourceExternalId) {
    const match = await transaction.lead.findFirst({
      where: {
        userId,
        sourceType: record.sourceType,
        sourceName: { equals: record.sourceName, mode: "insensitive" },
        sourceExternalId: record.sourceExternalId,
      },
      select: { scrapingJobId: true },
    });
    if (match) return match.scrapingJobId;
  }
  if (record.domain && record.city) {
    const match = await transaction.lead.findFirst({
      where: {
        userId,
        domain: record.domain,
        businessName: { equals: record.businessName, mode: "insensitive" },
        city: { equals: record.city, mode: "insensitive" },
      },
      select: { scrapingJobId: true },
    });
    if (match) return match.scrapingJobId;
  }
  if (record.phoneNormalized) {
    const match = await transaction.lead.findFirst({
      where: {
        userId,
        phoneNormalized: record.phoneNormalized,
        businessName: { equals: record.businessName, mode: "insensitive" },
      },
      select: { scrapingJobId: true },
    });
    if (match) return match.scrapingJobId;
  }
  if (record.addressLine1 && record.postalCode) {
    const match = await transaction.lead.findFirst({
      where: {
        userId,
        businessName: { equals: record.businessName, mode: "insensitive" },
        addressLine1: { equals: record.addressLine1, mode: "insensitive" },
        postalCode: record.postalCode,
      },
      select: { scrapingJobId: true },
    });
    return match?.scrapingJobId ?? null;
  }
  return null;
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

      const existingJobId = await findExistingJobId(
        transaction,
        record,
        options.userId,
      );
      if (existingJobId) {
        return existingJobId === options.scrapingJobId
          ? "SUCCESS"
          : "DUPLICATE";
      }

      await transaction.lead.create({
        data: {
          businessName: record.businessName,
          phoneRaw: record.phoneRaw,
          phoneNormalized: record.phoneNormalized,
          phoneType: record.phoneType,
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
          status: "NEW",
          isPublicBusinessContact: true,
          collectedAt: new Date(),
          userId: options.userId,
          scrapingJobId: options.scrapingJobId,
        },
      });
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
