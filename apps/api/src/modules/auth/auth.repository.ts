import { Prisma, type UserRole } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import type { RegisterInput, SessionMetadata } from "./auth.types.js";

const registrationUserSelect = {
  id: true,
  fullName: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

const currentUserSelect = {
  ...registrationUserSelect,
  lastLoginAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

const loginUserSelect = {
  ...currentUserSelect,
  passwordHash: true,
} satisfies Prisma.UserSelect;

type NewSessionData = {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  metadata: SessionMetadata;
};

export type AuditEventInput = {
  action: string;
  actorId?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
};

const sessionCreateData = (session: NewSessionData): Prisma.UserSessionUncheckedCreateInput => ({
  id: session.id,
  userId: session.userId,
  refreshTokenHash: session.refreshTokenHash,
  expiresAt: session.expiresAt,
  ...(session.metadata.ipAddress ? { ipAddress: session.metadata.ipAddress } : {}),
  ...(session.metadata.userAgent ? { userAgent: session.metadata.userAgent } : {}),
});

export const findUserByEmail = async (email: string) =>
  prisma.user.findUnique({
    where: { email },
    select: loginUserSelect,
  });

export const isEmailInUse = async (email: string): Promise<boolean> => {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  return user !== null;
};

export const createRegisteredUserWithSession = async (
  userId: string,
  input: RegisterInput,
  passwordHash: string,
  session: Omit<NewSessionData, "userId">,
) =>
  prisma.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        id: userId,
        email: input.email,
        fullName: input.fullName,
        passwordHash,
        role: "USER",
        status: "ACTIVE",
      },
      select: registrationUserSelect,
    });
    await transaction.userSession.create({
      data: sessionCreateData({ ...session, userId }),
    });
    return user;
  });

export const createLoginSession = async (session: NewSessionData) =>
  prisma.$transaction(async (transaction) => {
    await transaction.userSession.create({ data: sessionCreateData(session) });
    return transaction.user.update({
      where: { id: session.userId },
      data: { lastLoginAt: new Date() },
      select: registrationUserSelect,
    });
  });

export const findSessionForRefresh = async (sessionId: string) =>
  prisma.userSession.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      refreshTokenHash: true,
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
          role: true,
          status: true,
        },
      },
    },
  });

export const rotateSessionAtomically = async (
  oldSession: {
    id: string;
    userId: string;
    refreshTokenHash: string;
  },
  replacement: Omit<NewSessionData, "userId">,
): Promise<boolean> =>
  prisma.$transaction(async (transaction) => {
    const now = new Date();
    const result = await transaction.userSession.updateMany({
      where: {
        id: oldSession.id,
        userId: oldSession.userId,
        refreshTokenHash: oldSession.refreshTokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        revokedAt: now,
        lastUsedAt: now,
        replacedBySessionId: replacement.id,
      },
    });

    if (result.count !== 1) {
      return false;
    }

    await transaction.userSession.create({
      data: sessionCreateData({ ...replacement, userId: oldSession.userId }),
    });
    return true;
  });

export const revokeSession = async (
  sessionId: string,
  userId: string,
  refreshTokenHash: string,
): Promise<boolean> => {
  const result = await prisma.userSession.updateMany({
    where: {
      id: sessionId,
      userId,
      refreshTokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      lastUsedAt: new Date(),
    },
  });
  return result.count > 0;
};

export const revokeAllActiveSessions = async (userId: string): Promise<number> => {
  const result = await prisma.userSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return result.count;
};

export const findActiveSessionsForUser = async (userId: string) =>
  prisma.userSession.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

export const revokeSessionById = async (userId: string, sessionId: string): Promise<boolean> => {
  const result = await prisma.userSession.updateMany({
    where: {
      id: sessionId,
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      lastUsedAt: new Date(),
    },
  });
  return result.count > 0;
};

export const findActiveSessionUser = async (
  sessionId: string,
  userId: string,
) =>
  prisma.userSession.findFirst({
    where: {
      id: sessionId,
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      user: {
        select: {
          id: true,
          role: true,
          status: true,
        },
      },
    },
  });

export const findCurrentUserById = async (userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: currentUserSelect,
  });

export const recordAuditEvent = async (event: AuditEventInput): Promise<void> => {
  await prisma.auditLog.create({
    data: {
      action: event.action,
      entityType: "AUTH_SESSION",
      ...(event.actorId ? { actorId: event.actorId } : {}),
      ...(event.entityId ? { entityId: event.entityId } : {}),
      ...(event.metadata ? { metadata: event.metadata } : {}),
      ...(event.ipAddress ? { ipAddress: event.ipAddress } : {}),
      ...(event.userAgent ? { userAgent: event.userAgent } : {}),
    },
  });
};

export const isUniqueEmailConstraintError = (error: unknown): boolean => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const target: unknown = error.meta?.target;
  if (Array.isArray(target)) {
    return target.some((field) => field === "email");
  }
  return typeof target === "string" && target.toLowerCase().includes("email");
};

export type DatabaseUserRole = UserRole;
