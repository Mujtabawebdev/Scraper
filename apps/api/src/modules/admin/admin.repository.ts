import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import {
  adminAccessRequiredError,
  adminJobNotCancellableError,
  adminJobNotFoundError,
  adminUserNotFoundError,
  cannotModifyOwnRoleError,
  cannotModifySuperAdminError,
  finalSuperAdminRequiredError,
  invalidUserStatusTransitionError,
  sourceNotFoundError,
  superAdminAccessRequiredError,
} from "./admin.errors.js";
import type {
  AdminActionContext,
  CreateAdminSourceInput,
  ListAdminAuditLogsQuery,
  ListAdminJobsQuery,
  ListAdminSourcesQuery,
  ListAdminUsersQuery,
  UpdateAdminSourceInput,
  UpdateAdminUserRoleInput,
  UpdateAdminUserStatusInput,
} from "./admin.types.js";

export const adminOwnerSelect = {
  id: true,
  fullName: true,
  email: true,
} satisfies Prisma.UserSelect;

export const adminUserSummarySelect = {
  ...adminOwnerSelect,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

export const adminUserListSelect = {
  ...adminUserSummarySelect,
  _count: {
    select: {
      scrapingJobs: true,
      leads: true,
    },
  },
} satisfies Prisma.UserSelect;

export const adminJobSummarySelect = {
  id: true,
  source: true,
  status: true,
  searchQuery: true,
  name: true,
  location: true,
  requestedLimit: true,
  processedCount: true,
  successCount: true,
  failureCount: true,
  duplicateCount: true,
  progressPercentage: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
  failedAt: true,
  cancelledAt: true,
  user: { select: adminOwnerSelect },
  _count: { select: { leads: true } },
} satisfies Prisma.ScrapingJobSelect;

export const adminJobDetailSelect = {
  ...adminJobSummarySelect,
  updatedAt: true,
  errorMessage: true,
  queueJobId: true,
  retryOfJobId: true,
  retries: {
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      status: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ScrapingJobSelect;

export const adminAuditLogSelect = {
  id: true,
  action: true,
  entityType: true,
  entityId: true,
  metadata: true,
  ipAddress: true,
  userAgent: true,
  createdAt: true,
  actor: { select: adminOwnerSelect },
  targetUser: { select: adminOwnerSelect },
} satisfies Prisma.AuditLogSelect;

export const approvedSourceSelect = {
  id: true,
  key: true,
  displayName: true,
  sourceType: true,
  baseUrl: true,
  status: true,
  isEnabled: true,
  requiresApiKey: true,
  allowsAutomatedAccess: true,
  requestsPerMinute: true,
  maxConcurrency: true,
  robotsPolicyCheckedAt: true,
  termsReviewedAt: true,
  reviewNotes: true,
  blockedReason: true,
  lastHealthCheckAt: true,
  lastHealthCheckStatus: true,
  lastHealthCheckMessage: true,
  lastHealthCheckLatencyMs: true,
  lastSuccessfulRequestAt: true,
  recentFailureCount: true,
  quotaLimitedUntil: true,
  createdAt: true,
  updatedAt: true,
  createdBy: { select: adminOwnerSelect },
  updatedBy: { select: adminOwnerSelect },
} satisfies Prisma.ApprovedSourceSelect;

export type AdminUserSummaryRecord = Prisma.UserGetPayload<{
  select: typeof adminUserSummarySelect;
}>;
export type AdminUserListRecord = Prisma.UserGetPayload<{
  select: typeof adminUserListSelect;
}>;
export type AdminJobSummaryRecord = Prisma.ScrapingJobGetPayload<{
  select: typeof adminJobSummarySelect;
}>;
export type AdminJobDetailRecord = Prisma.ScrapingJobGetPayload<{
  select: typeof adminJobDetailSelect;
}>;
export type AdminAuditLogRecord = Prisma.AuditLogGetPayload<{
  select: typeof adminAuditLogSelect;
}>;
export type ApprovedSourceRecord = Prisma.ApprovedSourceGetPayload<{
  select: typeof approvedSourceSelect;
}>;

const auditData = (
  context: AdminActionContext,
  input: {
    action: string;
    entityType: string;
    entityId?: string;
    targetUserId?: string;
    metadata?: Prisma.InputJsonValue;
  },
): Prisma.AuditLogUncheckedCreateInput => ({
  action: input.action,
  entityType: input.entityType,
  actorId: context.actorUserId,
  ...(input.entityId ? { entityId: input.entityId } : {}),
  ...(input.targetUserId ? { targetUserId: input.targetUserId } : {}),
  ...(input.metadata ? { metadata: input.metadata } : {}),
  ...(context.ipAddress ? { ipAddress: context.ipAddress } : {}),
  ...(context.userAgent ? { userAgent: context.userAgent } : {}),
});

const startOfUtcDay = (): Date => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
};

export const getAdminSummaryCounts = async () => {
  const today = startOfUtcDay();
  const activeJobStatuses = ["PENDING", "QUEUED", "RUNNING"] as const;
  const [
    totalUsers,
    activeUsers,
    suspendedUsers,
    disabledUsers,
    usersCreatedToday,
    totalJobs,
    activeJobs,
    completedJobs,
    failedJobs,
    cancelledJobs,
    jobsCreatedToday,
    totalLeads,
    leadsCreatedToday,
    leadsWithPhone,
    leadsWithEmail,
    approvedSources,
    disabledSources,
    blockedSources,
    reviewRequiredSources,
  ] = await prisma.$transaction([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { status: "SUSPENDED" } }),
    prisma.user.count({ where: { status: "DISABLED" } }),
    prisma.user.count({ where: { createdAt: { gte: today } } }),
    prisma.scrapingJob.count(),
    prisma.scrapingJob.count({
      where: { status: { in: [...activeJobStatuses] } },
    }),
    prisma.scrapingJob.count({ where: { status: "COMPLETED" } }),
    prisma.scrapingJob.count({ where: { status: "FAILED" } }),
    prisma.scrapingJob.count({ where: { status: "CANCELLED" } }),
    prisma.scrapingJob.count({ where: { createdAt: { gte: today } } }),
    prisma.lead.count(),
    prisma.lead.count({ where: { createdAt: { gte: today } } }),
    prisma.lead.count({ where: { phoneRaw: { not: null } } }),
    prisma.lead.count({ where: { email: { not: null } } }),
    prisma.approvedSource.count({ where: { status: "APPROVED" } }),
    prisma.approvedSource.count({ where: { status: "DISABLED" } }),
    prisma.approvedSource.count({ where: { status: "BLOCKED" } }),
    prisma.approvedSource.count({ where: { status: "REVIEW_REQUIRED" } }),
  ]);

  return {
    totalUsers,
    activeUsers,
    suspendedUsers,
    disabledUsers,
    usersCreatedToday,
    totalJobs,
    activeJobs,
    completedJobs,
    failedJobs,
    cancelledJobs,
    jobsCreatedToday,
    totalLeads,
    leadsCreatedToday,
    leadsWithPhone,
    leadsWithEmail,
    approvedSources,
    disabledSources,
    blockedSources,
    reviewRequiredSources,
  };
};

const adminUsersWhere = (
  query: ListAdminUsersQuery,
): Prisma.UserWhereInput => ({
  ...(query.search
    ? {
        OR: [
          { fullName: { contains: query.search, mode: "insensitive" } },
          { email: { contains: query.search, mode: "insensitive" } },
        ],
      }
    : {}),
  ...(query.role ? { role: query.role } : {}),
  ...(query.status ? { status: query.status } : {}),
  ...(query.createdFrom || query.createdTo
    ? {
        createdAt: {
          ...(query.createdFrom ? { gte: query.createdFrom } : {}),
          ...(query.createdTo ? { lte: query.createdTo } : {}),
        },
      }
    : {}),
});

export const listAdminUsers = async (query: ListAdminUsersQuery) => {
  const where = adminUsersWhere(query);
  const orderBy = {
    [query.sortBy]: query.sortOrder,
  } satisfies Prisma.UserOrderByWithRelationInput;
  const [users, totalItems] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: adminUserListSelect,
    }),
    prisma.user.count({ where }),
  ]);
  return { users, totalItems };
};

export const findAdminUserSummary = async (
  userId: string,
): Promise<AdminUserSummaryRecord | null> =>
  prisma.user.findUnique({
    where: { id: userId },
    select: adminUserSummarySelect,
  });

export const getAdminUserDetailData = async (userId: string) => {
  const now = new Date();
  const [
    user,
    activeSessionCount,
    totalJobs,
    completedJobs,
    failedJobs,
    totalLeads,
    recentAuditEvents,
  ] = await prisma.$transaction([
    prisma.user.findUnique({
      where: { id: userId },
      select: adminUserSummarySelect,
    }),
    prisma.userSession.count({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
    }),
    prisma.scrapingJob.count({ where: { userId } }),
    prisma.scrapingJob.count({ where: { userId, status: "COMPLETED" } }),
    prisma.scrapingJob.count({ where: { userId, status: "FAILED" } }),
    prisma.lead.count({ where: { userId } }),
    prisma.auditLog.findMany({
      where: {
        OR: [{ actorId: userId }, { targetUserId: userId }],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: adminAuditLogSelect,
    }),
  ]);
  return {
    user,
    activeSessionCount,
    totalJobs,
    completedJobs,
    failedJobs,
    totalLeads,
    recentAuditEvents,
  };
};

const requireCurrentAdmin = async (
  transaction: Prisma.TransactionClient,
  context: AdminActionContext,
) => {
  const actor = await transaction.user.findUnique({
    where: { id: context.actorUserId },
    select: { id: true, role: true, status: true },
  });
  if (
    !actor ||
    actor.status !== "ACTIVE" ||
    (actor.role !== "ADMIN" && actor.role !== "SUPER_ADMIN")
  ) {
    throw adminAccessRequiredError();
  }
  return actor;
};

const validStatusTransitions = {
  ACTIVE: new Set(["SUSPENDED", "DISABLED"]),
  SUSPENDED: new Set(["ACTIVE", "DISABLED"]),
  DISABLED: new Set(["ACTIVE"]),
} as const;

export const updateAdminUserStatusTransaction = async (
  context: AdminActionContext,
  userId: string,
  input: UpdateAdminUserStatusInput,
) =>
  prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(810008001)`;
    const actor = await requireCurrentAdmin(transaction, context);
    const target = await transaction.user.findUnique({
      where: { id: userId },
      select: adminUserSummarySelect,
    });
    if (!target) throw adminUserNotFoundError();
    if (target.id === actor.id) throw invalidUserStatusTransitionError();
    if (actor.role === "ADMIN" && target.role !== "USER") {
      if (target.role === "SUPER_ADMIN") throw cannotModifySuperAdminError();
      throw adminAccessRequiredError();
    }
    if (!validStatusTransitions[target.status].has(input.status)) {
      throw invalidUserStatusTransitionError();
    }
    if (
      target.role === "SUPER_ADMIN" &&
      target.status === "ACTIVE" &&
      input.status !== "ACTIVE"
    ) {
      const activeSuperAdmins = await transaction.user.count({
        where: { role: "SUPER_ADMIN", status: "ACTIVE" },
      });
      if (activeSuperAdmins <= 1) throw finalSuperAdminRequiredError();
    }

    const activeJobs =
      input.status === "ACTIVE"
        ? []
        : await transaction.scrapingJob.findMany({
            where: {
              userId,
              status: { in: ["PENDING", "QUEUED", "RUNNING"] },
            },
            select: { id: true, queueJobId: true },
          });
    const updatedUser = await transaction.user.update({
      where: { id: userId },
      data: { status: input.status },
      select: adminUserSummarySelect,
    });
    const revokedSessions =
      input.status === "ACTIVE"
        ? { count: 0 }
        : await transaction.userSession.updateMany({
            where: { userId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
    const cancelledJobs =
      input.status === "ACTIVE"
        ? { count: 0 }
        : await transaction.scrapingJob.updateMany({
            where: {
              userId,
              status: { in: ["PENDING", "QUEUED", "RUNNING"] },
            },
            data: {
              status: "CANCELLED",
              cancelledAt: new Date(),
              errorMessage: null,
            },
          });

    await transaction.auditLog.create({
      data: auditData(context, {
        action: "ADMIN_USER_STATUS_CHANGED",
        entityType: "USER",
        entityId: userId,
        targetUserId: userId,
        metadata: {
          summary: `User status changed from ${target.status} to ${input.status}`,
          reason: input.reason,
          previousStatus: target.status,
          nextStatus: input.status,
          revokedSessionCount: revokedSessions.count,
          cancelledJobCount: cancelledJobs.count,
        },
      }),
    });
    return {
      user: updatedUser,
      queueJobIds: activeJobs
        .map((job) => job.queueJobId)
        .filter((value): value is string => value !== null),
      revokedSessionCount: revokedSessions.count,
      cancelledJobCount: cancelledJobs.count,
    };
  });

export const updateAdminUserRoleTransaction = async (
  context: AdminActionContext,
  userId: string,
  input: UpdateAdminUserRoleInput,
) =>
  prisma.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(810008002)`;
    const actor = await requireCurrentAdmin(transaction, context);
    if (actor.role !== "SUPER_ADMIN") throw superAdminAccessRequiredError();
    if (actor.id === userId) throw cannotModifyOwnRoleError();
    const target = await transaction.user.findUnique({
      where: { id: userId },
      select: adminUserSummarySelect,
    });
    if (!target) throw adminUserNotFoundError();
    if (target.role === input.role) throw cannotModifyOwnRoleError();
    if (target.role === "SUPER_ADMIN" && target.status === "ACTIVE") {
      const activeSuperAdmins = await transaction.user.count({
        where: { role: "SUPER_ADMIN", status: "ACTIVE" },
      });
      if (activeSuperAdmins <= 1) throw finalSuperAdminRequiredError();
    }

    const updatedUser = await transaction.user.update({
      where: { id: userId },
      data: { role: input.role },
      select: adminUserSummarySelect,
    });
    const revokedSessions = await transaction.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await transaction.auditLog.create({
      data: auditData(context, {
        action: "ADMIN_USER_ROLE_CHANGED",
        entityType: "USER",
        entityId: userId,
        targetUserId: userId,
        metadata: {
          summary: `User role changed from ${target.role} to ${input.role}`,
          reason: input.reason,
          previousRole: target.role,
          nextRole: input.role,
          revokedSessionCount: revokedSessions.count,
        },
      }),
    });
    return { user: updatedUser, revokedSessionCount: revokedSessions.count };
  });

const adminJobsWhere = (
  query: ListAdminJobsQuery,
): Prisma.ScrapingJobWhereInput => ({
  ...(query.userId ? { userId: query.userId } : {}),
  ...(query.userEmail
    ? { user: { email: { contains: query.userEmail, mode: "insensitive" } } }
    : {}),
  ...(query.status ? { status: query.status } : {}),
  ...(query.source ? { source: query.source } : {}),
  ...(query.search
    ? {
        OR: [
          { searchQuery: { contains: query.search, mode: "insensitive" } },
          { location: { contains: query.search, mode: "insensitive" } },
          { user: { fullName: { contains: query.search, mode: "insensitive" } } },
          { user: { email: { contains: query.search, mode: "insensitive" } } },
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

export const listAdminJobs = async (query: ListAdminJobsQuery) => {
  const where = adminJobsWhere(query);
  const orderBy = {
    [query.sortBy]: query.sortOrder,
  } satisfies Prisma.ScrapingJobOrderByWithRelationInput;
  const [jobs, totalItems] = await prisma.$transaction([
    prisma.scrapingJob.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: adminJobSummarySelect,
    }),
    prisma.scrapingJob.count({ where }),
  ]);
  return { jobs, totalItems };
};

export const findAdminJobDetail = async (
  jobId: string,
): Promise<AdminJobDetailRecord | null> =>
  prisma.scrapingJob.findUnique({
    where: { id: jobId },
    select: adminJobDetailSelect,
  });

export const cancelAdminJobTransaction = async (
  context: AdminActionContext,
  jobId: string,
  reason: string,
) =>
  prisma.$transaction(async (transaction) => {
    await requireCurrentAdmin(transaction, context);
    const job = await transaction.scrapingJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        userId: true,
        status: true,
        queueJobId: true,
      },
    });
    if (!job) throw adminJobNotFoundError();
    if (
      job.status !== "PENDING" &&
      job.status !== "QUEUED" &&
      job.status !== "RUNNING"
    ) {
      throw adminJobNotCancellableError();
    }
    const changed = await transaction.scrapingJob.updateMany({
      where: {
        id: jobId,
        status: { in: ["PENDING", "QUEUED", "RUNNING"] },
      },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        errorMessage: null,
      },
    });
    if (changed.count !== 1) throw adminJobNotCancellableError();
    await transaction.auditLog.create({
      data: auditData(context, {
        action: "ADMIN_SCRAPING_JOB_CANCELLED",
        entityType: "SCRAPING_JOB",
        entityId: jobId,
        targetUserId: job.userId,
        metadata: {
          summary: "Administrator cancelled an active scraping job",
          reason,
          previousStatus: job.status,
          targetUserId: job.userId,
        },
      }),
    });
    return { queueJobId: job.queueJobId };
  });

const adminAuditWhere = (
  query: ListAdminAuditLogsQuery,
): Prisma.AuditLogWhereInput => ({
  ...(query.action
    ? { action: { contains: query.action, mode: "insensitive" } }
    : {}),
  ...(query.actorUserId ? { actorId: query.actorUserId } : {}),
  ...(query.targetUserId ? { targetUserId: query.targetUserId } : {}),
  ...(query.entityType
    ? { entityType: { contains: query.entityType, mode: "insensitive" } }
    : {}),
  ...(query.entityId ? { entityId: query.entityId } : {}),
  ...(query.search
    ? {
        OR: [
          { action: { contains: query.search, mode: "insensitive" } },
          { entityType: { contains: query.search, mode: "insensitive" } },
          { entityId: { contains: query.search, mode: "insensitive" } },
          { actor: { fullName: { contains: query.search, mode: "insensitive" } } },
          { actor: { email: { contains: query.search, mode: "insensitive" } } },
          {
            targetUser: {
              fullName: { contains: query.search, mode: "insensitive" },
            },
          },
          {
            targetUser: {
              email: { contains: query.search, mode: "insensitive" },
            },
          },
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

export const listAdminAuditLogs = async (query: ListAdminAuditLogsQuery) => {
  const where = adminAuditWhere(query);
  const [auditLogs, totalItems] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: adminAuditLogSelect,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { auditLogs, totalItems };
};

const adminSourcesWhere = (
  query: ListAdminSourcesQuery,
): Prisma.ApprovedSourceWhereInput => ({
  ...(query.search
    ? {
        OR: [
          { displayName: { contains: query.search, mode: "insensitive" } },
          { key: { contains: query.search, mode: "insensitive" } },
        ],
      }
    : {}),
  ...(query.sourceType ? { sourceType: query.sourceType } : {}),
  ...(query.status ? { status: query.status } : {}),
  ...(query.isEnabled === undefined ? {} : { isEnabled: query.isEnabled }),
});

export const listAdminSources = async (query: ListAdminSourcesQuery) => {
  const where = adminSourcesWhere(query);
  const orderBy = {
    [query.sortBy]: query.sortOrder,
  } satisfies Prisma.ApprovedSourceOrderByWithRelationInput;
  const [sources, totalItems] = await prisma.$transaction([
    prisma.approvedSource.findMany({
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: approvedSourceSelect,
    }),
    prisma.approvedSource.count({ where }),
  ]);
  return { sources, totalItems };
};

export const findApprovedSourceById = async (
  sourceId: string,
): Promise<ApprovedSourceRecord | null> =>
  prisma.approvedSource.findUnique({
    where: { id: sourceId },
    select: approvedSourceSelect,
  });

export const findApprovedSourceByKey = async (sourceKey: string) =>
  prisma.approvedSource.findUnique({
    where: { key: sourceKey },
    select: approvedSourceSelect,
  });

export const createApprovedSource = async (
  context: AdminActionContext,
  input: CreateAdminSourceInput,
): Promise<ApprovedSourceRecord> =>
  prisma.$transaction(async (transaction) => {
    const source = await transaction.approvedSource.create({
      data: {
        key: input.key,
        displayName: input.displayName,
        sourceType: input.sourceType,
        baseUrl: input.baseUrl ?? null,
        status: "REVIEW_REQUIRED",
        isEnabled: false,
        requiresApiKey: input.requiresApiKey,
        allowsAutomatedAccess: false,
        requestsPerMinute: input.requestsPerMinute,
        maxConcurrency: input.maxConcurrency,
        robotsPolicyCheckedAt: input.robotsPolicyCheckedAt ?? null,
        termsReviewedAt: input.termsReviewedAt ?? null,
        reviewNotes: input.reviewNotes ?? null,
        blockedReason: null,
        createdByUserId: context.actorUserId,
        updatedByUserId: context.actorUserId,
      },
      select: approvedSourceSelect,
    });
    await transaction.auditLog.create({
      data: auditData(context, {
        action: "ADMIN_SOURCE_CREATED",
        entityType: "APPROVED_SOURCE",
        entityId: source.id,
        metadata: {
          summary: `Source ${source.key} created for review`,
          sourceKey: source.key,
          status: source.status,
          isEnabled: source.isEnabled,
        },
      }),
    });
    return source;
  });

export const updateApprovedSource = async (
  context: AdminActionContext,
  sourceId: string,
  input: UpdateAdminSourceInput,
  summary: string,
): Promise<ApprovedSourceRecord> =>
  prisma.$transaction(async (transaction) => {
    const existing = await transaction.approvedSource.findUnique({
      where: { id: sourceId },
      select: { id: true, key: true, status: true, isEnabled: true },
    });
    if (!existing) throw sourceNotFoundError();
    const data: Prisma.ApprovedSourceUncheckedUpdateInput = {
      ...(input.displayName !== undefined
        ? { displayName: input.displayName }
        : {}),
      ...(input.sourceType !== undefined ? { sourceType: input.sourceType } : {}),
      ...(input.baseUrl !== undefined ? { baseUrl: input.baseUrl } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.isEnabled !== undefined ? { isEnabled: input.isEnabled } : {}),
      ...(input.requiresApiKey !== undefined
        ? { requiresApiKey: input.requiresApiKey }
        : {}),
      ...(input.allowsAutomatedAccess !== undefined
        ? { allowsAutomatedAccess: input.allowsAutomatedAccess }
        : {}),
      ...(input.requestsPerMinute !== undefined
        ? { requestsPerMinute: input.requestsPerMinute }
        : {}),
      ...(input.maxConcurrency !== undefined
        ? { maxConcurrency: input.maxConcurrency }
        : {}),
      ...(input.robotsPolicyCheckedAt !== undefined
        ? { robotsPolicyCheckedAt: input.robotsPolicyCheckedAt }
        : {}),
      ...(input.termsReviewedAt !== undefined
        ? { termsReviewedAt: input.termsReviewedAt }
        : {}),
      ...(input.reviewNotes !== undefined
        ? { reviewNotes: input.reviewNotes }
        : {}),
      ...(input.blockedReason !== undefined
        ? { blockedReason: input.blockedReason }
        : {}),
      updatedByUserId: context.actorUserId,
    };
    const source = await transaction.approvedSource.update({
      where: { id: sourceId },
      data,
      select: approvedSourceSelect,
    });
    await transaction.auditLog.create({
      data: auditData(context, {
        action: "ADMIN_SOURCE_UPDATED",
        entityType: "APPROVED_SOURCE",
        entityId: sourceId,
        metadata: {
          summary,
          sourceKey: source.key,
          previousStatus: existing.status,
          nextStatus: source.status,
          previousEnabled: existing.isEnabled,
          nextEnabled: source.isEnabled,
        },
      }),
    });
    return source;
  });

export const recordSourceRobotsCheck = async (
  sourceKey: string,
): Promise<void> => {
  await prisma.approvedSource.updateMany({
    where: { key: sourceKey },
    data: { robotsPolicyCheckedAt: new Date() },
  });
};

export const setSourcePolicyState = async (
  sourceKey: string,
  input: {
    status: "BLOCKED" | "REVIEW_REQUIRED";
    reason: string;
  },
): Promise<void> => {
  await prisma.approvedSource.updateMany({
    where: { key: sourceKey },
    data: {
      status: input.status,
      isEnabled: false,
      allowsAutomatedAccess: false,
      ...(input.status === "BLOCKED"
        ? { blockedReason: input.reason }
        : { reviewNotes: input.reason, blockedReason: null }),
    },
  });
};

export const recordSourceHealthCheck = async (
  context: AdminActionContext,
  sourceId: string,
  input: {
    status:
      | "HEALTHY"
      | "DEGRADED"
      | "UNAVAILABLE"
      | "CONFIGURATION_MISSING"
      | "QUOTA_LIMITED"
      | "BLOCKED";
    message: string;
    latencyMs?: number;
    quotaLimitedUntil?: Date | null;
  },
): Promise<ApprovedSourceRecord> =>
  prisma.$transaction(async (transaction) => {
    const now = new Date();
    const existing = await transaction.approvedSource.findUnique({
      where: { id: sourceId },
      select: { id: true, key: true, recentFailureCount: true },
    });
    if (!existing) throw sourceNotFoundError();
    const success = input.status === "HEALTHY";
    const source = await transaction.approvedSource.update({
      where: { id: sourceId },
      data: {
        lastHealthCheckAt: now,
        lastHealthCheckStatus: input.status,
        lastHealthCheckMessage: input.message.slice(0, 500),
        ...(input.latencyMs !== undefined
          ? { lastHealthCheckLatencyMs: input.latencyMs }
          : {}),
        ...(success ? { lastSuccessfulRequestAt: now } : {}),
        recentFailureCount: success ? 0 : existing.recentFailureCount + 1,
        ...(input.quotaLimitedUntil !== undefined
          ? { quotaLimitedUntil: input.quotaLimitedUntil }
          : {}),
        updatedByUserId: context.actorUserId,
      },
      select: approvedSourceSelect,
    });
    await transaction.auditLog.create({
      data: auditData(context, {
        action: "ADMIN_SOURCE_HEALTH_CHECKED",
        entityType: "APPROVED_SOURCE",
        entityId: source.id,
        metadata: {
          summary: `Source ${source.key} health check: ${input.status}`,
          sourceKey: source.key,
          status: input.status,
          latencyMs: input.latencyMs ?? null,
        },
      }),
    });
    return source as ApprovedSourceRecord;
  });
