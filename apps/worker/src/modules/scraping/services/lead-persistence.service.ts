import { prisma } from "../../../infrastructure/database/prisma.js";
import type { NormalizedBusiness } from "./lead-normalization.service.js";

const findExistingJobId = async (record: NormalizedBusiness): Promise<string | null> => {
  if (record.sourceExternalId) {
    const match = await prisma.lead.findFirst({
      where: {
        sourceType: record.sourceType,
        sourceName: { equals: record.sourceName, mode: "insensitive" },
        sourceExternalId: record.sourceExternalId,
      },
      select: { scrapingJobId: true },
    });
    if (match) return match.scrapingJobId;
  }
  if (record.domain && record.city) {
    const match = await prisma.lead.findFirst({
      where: {
        domain: record.domain,
        businessName: { equals: record.businessName, mode: "insensitive" },
        city: { equals: record.city, mode: "insensitive" },
      },
      select: { scrapingJobId: true },
    });
    if (match) return match.scrapingJobId;
  }
  if (record.phoneNormalized) {
    const match = await prisma.lead.findFirst({
      where: {
        phoneNormalized: record.phoneNormalized,
        businessName: { equals: record.businessName, mode: "insensitive" },
      },
      select: { scrapingJobId: true },
    });
    if (match) return match.scrapingJobId;
  }
  if (record.addressLine1 && record.postalCode) {
    const match = await prisma.lead.findFirst({
      where: {
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
  scrapingJobId: string,
  onProgress?: (completed: number, total: number) => Promise<void>,
): Promise<{ collectedCount: number; duplicateCount: number }> => {
  let collectedCount = 0;
  let duplicateCount = 0;

  for (const [index, record] of records.entries()) {
    const existingJobId = await findExistingJobId(record);
    if (existingJobId) {
      if (existingJobId === scrapingJobId) collectedCount += 1;
      else duplicateCount += 1;
    } else {
      await prisma.lead.create({
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
          scrapingJobId,
        },
      });
      collectedCount += 1;
    }
    if (onProgress) await onProgress(index + 1, records.length);
  }
  return { collectedCount, duplicateCount };
};
