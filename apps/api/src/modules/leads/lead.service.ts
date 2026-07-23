import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import type { z } from "zod";
import type { listLeadsQuerySchema } from "./lead.schemas.js";

type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;

export const listLeads = async (query: ListLeadsQuery) => {
  const where: Prisma.LeadWhereInput = {
    ...(query.scrapingJobId ? { scrapingJobId: query.scrapingJobId } : {}),
    ...(query.city ? { city: { equals: query.city, mode: "insensitive" } } : {}),
    ...(query.state ? { state: { equals: query.state, mode: "insensitive" } } : {}),
    ...(query.category ? { category: { equals: query.category, mode: "insensitive" } } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.hasPhone === true ? { phoneNormalized: { not: null } } : {}),
    ...(query.hasPhone === false ? { phoneNormalized: null } : {}),
  };
  const skip = (query.page - 1) * query.limit;
  const [data, total] = await prisma.$transaction([
    prisma.lead.findMany({ where, skip, take: query.limit, orderBy: { createdAt: "desc" } }),
    prisma.lead.count({ where }),
  ]);
  return {
    data,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  };
};

export const getLead = async (id: string) => prisma.lead.findUnique({ where: { id } });
