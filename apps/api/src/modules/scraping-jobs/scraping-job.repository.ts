import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import type {
  ListScrapingJobsQuery,
  NewScrapingJobData,
} from "./scraping-job.types.js";

export const scrapingJobSummarySelect = {
  id: true,
  name: true,
  source: true,
  status: true,
  searchQuery: true,
  location: true,
  requestedLimit: true,
  processedCount: true,
  successCount: true,
  failureCount: true,
  duplicateCount: true,
  progressPercentage: true,
  pipelineStage: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
  failedAt: true,
  cancelledAt: true,
} satisfies Prisma.ScrapingJobSelect;

export const scrapingJobDetailSelect = {
  ...scrapingJobSummarySelect,
  updatedAt: true,
  errorMessage: true,
  queueJobId: true,
  retryOfJobId: true,
  _count: { select: { leads: true } },
} satisfies Prisma.ScrapingJobSelect;

const retrySourceSelect = {
  id: true,
  userId: true,
  source: true,
  status: true,
  searchQuery: true,
  location: true,
  requestedLimit: true,
  country: true,
  state: true,
  city: true,
  category: true,
} satisfies Prisma.ScrapingJobSelect;

type GeneratedScrapingJobSummaryRecord = Prisma.ScrapingJobGetPayload<{
  select: typeof scrapingJobSummarySelect;
}>;

export type ScrapingJobSummaryRecord = Omit<
  GeneratedScrapingJobSummaryRecord,
  "pipelineStage"
> & {
  pipelineStage?: GeneratedScrapingJobSummaryRecord["pipelineStage"];
};

type GeneratedScrapingJobDetailRecord = Prisma.ScrapingJobGetPayload<{
  select: typeof scrapingJobDetailSelect;
}>;

export type ScrapingJobDetailRecord = Omit<
  GeneratedScrapingJobDetailRecord,
  "pipelineStage"
> & {
  pipelineStage?: GeneratedScrapingJobDetailRecord["pipelineStage"];
};

export type ScrapingJobRetrySourceRecord = Prisma.ScrapingJobGetPayload<{
  select: typeof retrySourceSelect;
}>;

const createWhere = (
  userId: string,
  query: ListScrapingJobsQuery,
): Prisma.ScrapingJobWhereInput => ({
  userId,
  ...(query.status ? { status: query.status } : {}),
  ...(query.source ? { source: query.source } : {}),
  ...(query.search
    ? {
        OR: [
          { searchQuery: { contains: query.search, mode: "insensitive" } },
          { location: { contains: query.search, mode: "insensitive" } },
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

const createOrderBy = (
  query: ListScrapingJobsQuery,
): Prisma.ScrapingJobOrderByWithRelationInput => {
  switch (query.sortBy) {
    case "updatedAt":
      return { updatedAt: query.sortOrder };
    case "status":
      return { status: query.sortOrder };
    case "progressPercentage":
      return { progressPercentage: query.sortOrder };
    case "successCount":
      return { successCount: query.sortOrder };
    case "createdAt":
      return { createdAt: query.sortOrder };
  }
};

export const createScrapingJobRecord = async (
  data: NewScrapingJobData,
): Promise<ScrapingJobSummaryRecord> =>
  prisma.scrapingJob.create({
    data: {
      name: data.searchQuery.slice(0, 150),
      source: data.source,
      location: data.location,
      searchQuery: data.searchQuery,
      requestedLimit: data.requestedLimit,
      userId: data.userId,
      status: "PENDING",
      country: data.country ?? "United States",
      ...(data.state ? { state: data.state } : {}),
      ...(data.city ? { city: data.city } : {}),
      ...(data.category ? { category: data.category } : {}),
      ...(data.retryOfJobId ? { retryOfJobId: data.retryOfJobId } : {}),
    },
    select: scrapingJobSummarySelect,
  });

export const countRecentOwnedJobsBySource = async (
  userId: string,
  source: string,
  since: Date,
): Promise<number> =>
  prisma.scrapingJob.count({
    where: { userId, source, createdAt: { gte: since } },
  });

export const markScrapingJobQueued = async (
  id: string,
  userId: string,
  queueJobId: string,
): Promise<void> => {
  const transitioned = await prisma.scrapingJob.updateMany({
    where: { id, userId, status: "PENDING" },
    data: { status: "QUEUED", queueJobId },
  });

  if (transitioned.count === 0) {
    // The worker may have already changed PENDING to RUNNING. Persisting the
    // queue ID separately must never move that job backwards to QUEUED.
    await prisma.scrapingJob.updateMany({
      where: { id, userId, queueJobId: null },
      data: { queueJobId },
    });
  }
};

export const markScrapingJobEnqueueFailed = async (
  id: string,
  userId: string,
): Promise<void> => {
  await prisma.scrapingJob.updateMany({
    where: { id, userId, status: { in: ["PENDING", "QUEUED"] } },
    data: {
      status: "FAILED",
      failedAt: new Date(),
      errorMessage: "Queue submission failed",
    },
  });
};

export const findOwnedScrapingJobSummary = async (
  id: string,
  userId: string,
): Promise<ScrapingJobSummaryRecord | null> =>
  prisma.scrapingJob.findFirst({
    where: { id, userId },
    select: scrapingJobSummarySelect,
  });

export const findOwnedScrapingJobDetail = async (
  id: string,
  userId: string,
): Promise<ScrapingJobDetailRecord | null> =>
  prisma.scrapingJob.findFirst({
    where: { id, userId },
    select: {
      ...scrapingJobDetailSelect,
      _count: {
        select: {
          leads: { where: { userId } },
        },
      },
    },
  });

export const findOwnedScrapingJobForRetry = async (
  id: string,
  userId: string,
): Promise<ScrapingJobRetrySourceRecord | null> =>
  prisma.scrapingJob.findFirst({
    where: { id, userId },
    select: retrySourceSelect,
  });

export const listOwnedScrapingJobs = async (
  userId: string,
  query: ListScrapingJobsQuery,
): Promise<{ jobs: ScrapingJobSummaryRecord[]; totalItems: number }> => {
  const where = createWhere(userId, query);
  const [jobs, totalItems] = await prisma.$transaction([
    prisma.scrapingJob.findMany({
      where,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      orderBy: createOrderBy(query),
      select: scrapingJobSummarySelect,
    }),
    prisma.scrapingJob.count({ where }),
  ]);
  return { jobs, totalItems };
};

export const cancelOwnedScrapingJob = async (
  id: string,
  userId: string,
): Promise<boolean> => {
  const result = await prisma.scrapingJob.updateMany({
    where: {
      id,
      userId,
      status: { in: ["PENDING", "QUEUED", "RUNNING"] },
    },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      errorMessage: null,
    },
  });
  return result.count === 1;
};
