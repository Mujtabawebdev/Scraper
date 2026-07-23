import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import type {
  ExportLeadsQuery,
  LeadFilters,
  ListLeadsQuery,
} from "./lead.types.js";

export const leadSummarySelect = {
  id: true,
  businessName: true,
  phoneRaw: true,
  phoneNormalized: true,
  phoneExtension: true,
  phoneCountryCode: true,
  phoneNationalFormat: true,
  phoneType: true,
  phoneValidationStatus: true,
  email: true,
  website: true,
  category: true,
  city: true,
  state: true,
  createdAt: true,
  sourceType: true,
  confidenceScore: true,
  confidenceLevel: true,
  lastVerifiedAt: true,
  _count: { select: { provenance: true } },
  scrapingJob: { select: { source: true } },
} satisfies Prisma.LeadSelect;

export const leadDetailSelect = {
  ...leadSummarySelect,
  addressLine1: true,
  addressLine2: true,
  postalCode: true,
  country: true,
  sourceUrl: true,
  scrapingJobId: true,
  googlePlaceId: true,
  officialWebsiteDomain: true,
  updatedAt: true,
} satisfies Prisma.LeadSelect;

type GeneratedLeadSummaryRecord = Prisma.LeadGetPayload<{
  select: typeof leadSummarySelect;
}>;

type Phase9SummaryKeys =
  | "_count"
  | "phoneNormalized"
  | "phoneExtension"
  | "phoneCountryCode"
  | "phoneNationalFormat"
  | "phoneType"
  | "phoneValidationStatus"
  | "sourceType"
  | "confidenceScore"
  | "confidenceLevel"
  | "lastVerifiedAt";

export type LeadSummaryRecord = Omit<
  GeneratedLeadSummaryRecord,
  Phase9SummaryKeys
> &
  Partial<Pick<GeneratedLeadSummaryRecord, Phase9SummaryKeys>>;

type GeneratedLeadDetailRecord = Prisma.LeadGetPayload<{
  select: typeof leadDetailSelect;
}>;

export type LeadDetailRecord = Omit<
  GeneratedLeadDetailRecord,
  Phase9SummaryKeys | "googlePlaceId" | "officialWebsiteDomain"
> &
  Partial<
    Pick<
      GeneratedLeadDetailRecord,
      Phase9SummaryKeys | "googlePlaceId" | "officialWebsiteDomain"
    >
  >;

const createLeadWhere = (
  userId: string,
  query: LeadFilters | ExportLeadsQuery,
): Prisma.LeadWhereInput => ({
  userId,
  ...(query.jobId ? { scrapingJobId: query.jobId } : {}),
  ...(query.source
    ? { scrapingJob: { is: { userId, source: query.source } } }
    : {}),
  ...(query.sourceType ? { sourceType: query.sourceType } : {}),
  ...(query.phoneValidationStatus
    ? { phoneValidationStatus: query.phoneValidationStatus }
    : {}),
  ...(query.confidenceLevel
    ? { confidenceLevel: query.confidenceLevel }
    : {}),
  ...(query.category
    ? { category: { equals: query.category, mode: "insensitive" } }
    : {}),
  ...(query.city ? { city: { equals: query.city, mode: "insensitive" } } : {}),
  ...(query.state ? { state: { equals: query.state, mode: "insensitive" } } : {}),
  ...(query.hasPhone === true ? { phoneRaw: { not: null } } : {}),
  ...(query.hasPhone === false ? { phoneRaw: null } : {}),
  ...(query.hasValidPhone === true
    ? { phoneValidationStatus: "VALID" }
    : {}),
  ...(query.hasValidPhone === false
    ? { phoneValidationStatus: { not: "VALID" } }
    : {}),
  ...(query.hasEmail === true ? { email: { not: null } } : {}),
  ...(query.hasEmail === false ? { email: null } : {}),
  ...(query.hasWebsite === true ? { website: { not: null } } : {}),
  ...(query.hasWebsite === false ? { website: null } : {}),
  ...(query.search
    ? {
        OR: [
          { businessName: { contains: query.search, mode: "insensitive" } },
          { phoneRaw: { contains: query.search, mode: "insensitive" } },
          { email: { contains: query.search, mode: "insensitive" } },
          { website: { contains: query.search, mode: "insensitive" } },
          { city: { contains: query.search, mode: "insensitive" } },
          { state: { contains: query.search, mode: "insensitive" } },
        ],
      }
    : {}),
  ...(query.createdFrom || query.createdTo
    ? {
        createdAt: {
          ...(query.createdFrom ? { gte: query.createdFrom } : {}),
          ...(query.createdTo ? { lte: query.createdTo } : {}),
        },
      }
    : {}),
  ...(query.lastVerifiedFrom || query.lastVerifiedTo
    ? {
        lastVerifiedAt: {
          ...(query.lastVerifiedFrom ? { gte: query.lastVerifiedFrom } : {}),
          ...(query.lastVerifiedTo ? { lte: query.lastVerifiedTo } : {}),
        },
      }
    : {}),
});

const createLeadOrderBy = (
  query: Pick<LeadFilters, "sortBy" | "sortOrder">,
): Prisma.LeadOrderByWithRelationInput => {
  switch (query.sortBy) {
    case "businessName":
      return { businessName: query.sortOrder };
    case "city":
      return { city: query.sortOrder };
    case "state":
      return { state: query.sortOrder };
    case "source":
      return { scrapingJob: { source: query.sortOrder } };
    case "confidenceScore":
      return { confidenceScore: query.sortOrder };
    case "lastVerifiedAt":
      return { lastVerifiedAt: query.sortOrder };
    case "createdAt":
      return { createdAt: query.sortOrder };
  }
};

export const listOwnedLeads = async (
  userId: string,
  query: ListLeadsQuery,
): Promise<{ leads: LeadSummaryRecord[]; totalItems: number }> => {
  const where = createLeadWhere(userId, query);
  const [leads, totalItems] = await prisma.$transaction([
    prisma.lead.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: createLeadOrderBy(query),
      select: leadSummarySelect,
    }),
    prisma.lead.count({ where }),
  ]);
  return { leads, totalItems };
};

export const findOwnedLeadDetail = async (
  id: string,
  userId: string,
): Promise<LeadDetailRecord | null> =>
  prisma.lead.findFirst({
    where: { id, userId },
    select: leadDetailSelect,
  });

export const listOwnedLeadsForExport = async (
  userId: string,
  query: ExportLeadsQuery,
  take: number,
): Promise<LeadDetailRecord[]> =>
  prisma.lead.findMany({
    where: createLeadWhere(userId, query),
    take,
    orderBy: createLeadOrderBy(query),
    select: leadDetailSelect,
  });

export const findOwnedLeadForVerification = async (
  id: string,
  userId: string,
) =>
  prisma.lead.findFirst({
    where: { id, userId },
    select: {
      id: true,
      userId: true,
      phoneRaw: true,
      confidenceScore: true,
      sourceName: true,
      sourceUrl: true,
      sourceExternalId: true,
      googlePlaceId: true,
    },
  });

export const listOwnedLeadProvenance = async (
  leadId: string,
  userId: string,
) =>
  prisma.leadProvenance.findMany({
    where: { leadId, lead: { userId } },
    orderBy: { sourceCollectedAt: "desc" },
    select: {
      id: true,
      sourceKey: true,
      sourceType: true,
      sourceRecordId: true,
      sourceUrl: true,
      sourceCollectedAt: true,
      sourceLastCheckedAt: true,
      sourceConfidenceScore: true,
      verificationStatus: true,
      extractionMethod: true,
      phoneRaw: true,
      phoneNormalized: true,
      email: true,
      website: true,
      googlePlaceId: true,
      confidenceContribution: true,
      approvedSource: { select: { displayName: true } },
    },
  });

export const updateOwnedLeadPhoneVerification = async (
  id: string,
  userId: string,
  input: {
    phoneNormalized: string | null;
    phoneExtension: string | null;
    phoneCountryCode: string | null;
    phoneNationalFormat: string | null;
    phoneType: "LANDLINE" | "MOBILE" | "VOIP" | "TOLL_FREE" | "UNKNOWN";
    phoneValidationStatus:
      | "VALID"
      | "POSSIBLE"
      | "INVALID"
      | "PLACEHOLDER"
      | "NO_PHONE_FOUND";
    confidenceScore: number;
    confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";
  },
): Promise<boolean> => {
  const now = new Date();
  const result = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.lead.updateMany({
      where: { id, userId },
      data: {
        ...input,
        status: input.phoneValidationStatus === "VALID" ? "VERIFIED" : "INVALID",
        lastVerifiedAt: now,
      },
    });
    if (updated.count === 0) return false;
    await transaction.leadProvenance.create({
      data: {
        leadId: id,
        sourceKey: "local-phone-validation",
        sourceType: "OFFICIAL_API",
        sourceCollectedAt: now,
        sourceLastCheckedAt: now,
        sourceConfidenceScore: input.confidenceScore,
        verificationStatus: input.phoneValidationStatus,
        extractionMethod: "LOCAL_REVALIDATION",
        phoneNormalized: input.phoneNormalized,
        confidenceContribution:
          input.phoneValidationStatus === "VALID" ? 10 : -25,
        rawSourceMetadata: {
          validationScope: "format-and-plausibility-only",
          subscriberOwnershipVerified: false,
        },
      },
    });
    await transaction.auditLog.create({
      data: {
        action: "LEAD_PHONE_LOCALLY_VERIFIED",
        entityType: "LEAD",
        entityId: id,
        actorId: userId,
        metadata: {
          summary: "Lead phone format and plausibility rechecked locally",
          validationStatus: input.phoneValidationStatus,
        },
      },
    });
    return true;
  });
  return result;
};
