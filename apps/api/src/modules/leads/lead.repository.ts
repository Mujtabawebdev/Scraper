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
  email: true,
  website: true,
  category: true,
  city: true,
  state: true,
  createdAt: true,
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
  updatedAt: true,
} satisfies Prisma.LeadSelect;

export type LeadSummaryRecord = Prisma.LeadGetPayload<{
  select: typeof leadSummarySelect;
}>;

export type LeadDetailRecord = Prisma.LeadGetPayload<{
  select: typeof leadDetailSelect;
}>;

const createLeadWhere = (
  userId: string,
  query: LeadFilters | ExportLeadsQuery,
): Prisma.LeadWhereInput => ({
  userId,
  ...(query.jobId ? { scrapingJobId: query.jobId } : {}),
  ...(query.source
    ? { scrapingJob: { is: { userId, source: query.source } } }
    : {}),
  ...(query.category
    ? { category: { equals: query.category, mode: "insensitive" } }
    : {}),
  ...(query.city ? { city: { equals: query.city, mode: "insensitive" } } : {}),
  ...(query.state ? { state: { equals: query.state, mode: "insensitive" } } : {}),
  ...(query.hasPhone === true ? { phoneRaw: { not: null } } : {}),
  ...(query.hasPhone === false ? { phoneRaw: null } : {}),
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
