import { randomUUID } from "node:crypto";

import { logger } from "../../common/logger/logger.js";
import type { UserStatus } from "../../generated/prisma/enums.js";
import {
  AUTH_AUDIT_ACTION,
  NON_LOGIN_PASSWORD_HASH,
  SYSTEM_USER_EMAIL,
} from "./auth.constants.js";
import {
  accountDisabledError,
  accountSuspendedError,
  emailAlreadyInUseError,
  invalidAccessTokenError,
  invalidCredentialsError,
  invalidRefreshTokenError,
  refreshTokenReuseError,
} from "./auth.errors.js";
import {
  createLoginSession,
  createRegisteredUserWithSession,
  findCurrentUserById,
  findSessionForRefresh,
  findUserByEmail,
  isEmailInUse,
  isUniqueEmailConstraintError,
  recordAuditEvent,
  revokeAllActiveSessions,
  revokeSession,
  rotateSessionAtomically,
  type AuditEventInput,
} from "./auth.repository.js";
import { hashPassword, verifyPassword } from "./password.service.js";
import {
  prepareSession,
  refreshTokenMatchesHash,
} from "./session.service.js";
import { verifyRefreshToken } from "./token.service.js";
import type {
  AuthenticationResult,
  CurrentUserResponse,
  LoginInput,
  RefreshTokenClaims,
  RefreshResult,
  RegisterInput,
  SessionMetadata,
} from "./auth.types.js";

const assertActiveStatus = (status: UserStatus): void => {
  if (status === "SUSPENDED") {
    throw accountSuspendedError();
  }
  if (status === "DISABLED") {
    throw accountDisabledError();
  }
};

const auditSafely = async (event: AuditEventInput): Promise<void> => {
  try {
    await recordAuditEvent(event);
  } catch (error: unknown) {
    logger.warn(
      {
        action: event.action,
        errorType: error instanceof Error ? error.name : "UnknownError",
      },
      "Authentication audit event could not be persisted",
    );
  }
};

const auditLoginFailure = async (
  metadata: SessionMetadata,
  actorId?: string,
  reason = "invalid_credentials",
): Promise<void> =>
  auditSafely({
    action: AUTH_AUDIT_ACTION.loginFailed,
    metadata: { reason },
    ...(actorId ? { actorId } : {}),
    ...metadata,
  });

export const registerUser = async (
  input: RegisterInput,
  metadata: SessionMetadata,
): Promise<AuthenticationResult> => {
  if (await isEmailInUse(input.email)) {
    throw emailAlreadyInUseError();
  }

  const userId = randomUUID();
  const passwordHash = await hashPassword(input.password);
  const session = await prepareSession(userId, "USER", metadata);

  try {
    const user = await createRegisteredUserWithSession(userId, input, passwordHash, {
      id: session.id,
      refreshTokenHash: session.refreshTokenHash,
      expiresAt: session.expiresAt,
      metadata,
    });

    await auditSafely({
      action: AUTH_AUDIT_ACTION.registerSuccess,
      actorId: user.id,
      entityId: session.id,
      metadata: { role: user.role },
      ...metadata,
    });

    return {
      user,
      accessToken: session.tokens.accessToken,
      refreshToken: session.tokens.refreshToken,
      accessTokenExpiresIn: session.tokens.accessTokenExpiresIn,
    };
  } catch (error: unknown) {
    if (isUniqueEmailConstraintError(error)) {
      throw emailAlreadyInUseError();
    }
    throw error;
  }
};

export const loginUser = async (
  input: LoginInput,
  metadata: SessionMetadata,
): Promise<AuthenticationResult> => {
  const user = await findUserByEmail(input.email);
  const isSystemAccount = input.email === SYSTEM_USER_EMAIL;
  const storedHash = user && !isSystemAccount ? user.passwordHash : NON_LOGIN_PASSWORD_HASH;
  const passwordMatches = await verifyPassword(storedHash, input.password);

  if (!user || !passwordMatches || isSystemAccount) {
    await auditLoginFailure(metadata, user?.id);
    throw invalidCredentialsError();
  }

  try {
    assertActiveStatus(user.status);
  } catch (error: unknown) {
    await auditLoginFailure(metadata, user.id, user.status.toLowerCase());
    throw error;
  }

  const session = await prepareSession(user.id, user.role, metadata);
  const updatedUser = await createLoginSession({
    id: session.id,
    userId: user.id,
    refreshTokenHash: session.refreshTokenHash,
    expiresAt: session.expiresAt,
    metadata,
  });

  await auditSafely({
    action: AUTH_AUDIT_ACTION.loginSuccess,
    actorId: user.id,
    entityId: session.id,
    metadata: { role: user.role },
    ...metadata,
  });

  return {
    user: updatedUser,
    accessToken: session.tokens.accessToken,
    refreshToken: session.tokens.refreshToken,
    accessTokenExpiresIn: session.tokens.accessTokenExpiresIn,
  };
};

const handleRefreshReuse = async (
  userId: string,
  sessionId: string,
  metadata: SessionMetadata,
): Promise<never> => {
  await revokeAllActiveSessions(userId);
  logger.warn({ userId, sessionId }, "Refresh token reuse detected; active sessions revoked");
  await auditSafely({
    action: AUTH_AUDIT_ACTION.refreshReuseDetected,
    actorId: userId,
    entityId: sessionId,
    metadata: { response: "all_sessions_revoked" },
    ...metadata,
  });
  throw refreshTokenReuseError();
};

export const refreshAuthentication = async (
  refreshToken: string,
  metadata: SessionMetadata,
): Promise<RefreshResult> => {
  const claims = await verifyRefreshToken(refreshToken);
  const session = await findSessionForRefresh(claims.sessionId);

  if (
    !session ||
    session.userId !== claims.userId ||
    !refreshTokenMatchesHash(session.refreshTokenHash, refreshToken)
  ) {
    throw invalidRefreshTokenError();
  }

  if (session.revokedAt) {
    return handleRefreshReuse(session.userId, session.id, metadata);
  }
  if (session.expiresAt.getTime() <= Date.now()) {
    throw invalidRefreshTokenError();
  }

  assertActiveStatus(session.user.status);
  const replacement = await prepareSession(session.userId, session.user.role, metadata);
  const rotated = await rotateSessionAtomically(
    {
      id: session.id,
      userId: session.userId,
      refreshTokenHash: session.refreshTokenHash,
    },
    {
      id: replacement.id,
      refreshTokenHash: replacement.refreshTokenHash,
      expiresAt: replacement.expiresAt,
      metadata,
    },
  );

  if (!rotated) {
    const latestSession = await findSessionForRefresh(session.id);
    if (
      latestSession?.revokedAt &&
      refreshTokenMatchesHash(latestSession.refreshTokenHash, refreshToken)
    ) {
      return handleRefreshReuse(session.userId, session.id, metadata);
    }
    throw invalidRefreshTokenError();
  }

  await auditSafely({
    action: AUTH_AUDIT_ACTION.refreshSuccess,
    actorId: session.userId,
    entityId: replacement.id,
    metadata: { replacedSessionId: session.id },
    ...metadata,
  });

  return {
    accessToken: replacement.tokens.accessToken,
    refreshToken: replacement.tokens.refreshToken,
    accessTokenExpiresIn: replacement.tokens.accessTokenExpiresIn,
  };
};

export const logoutSession = async (
  refreshToken: string | undefined,
  metadata: SessionMetadata,
): Promise<void> => {
  if (!refreshToken) {
    return;
  }

  let claims: RefreshTokenClaims;
  try {
    claims = await verifyRefreshToken(refreshToken);
  } catch {
    // Logout is intentionally idempotent for expired and malformed cookies.
    return;
  }

  const session = await findSessionForRefresh(claims.sessionId);
  if (
    !session ||
    session.userId !== claims.userId ||
    !refreshTokenMatchesHash(session.refreshTokenHash, refreshToken)
  ) {
    return;
  }

  await revokeSession(session.id, session.userId, session.refreshTokenHash);
  await auditSafely({
    action: AUTH_AUDIT_ACTION.logout,
    actorId: session.userId,
    entityId: session.id,
    ...metadata,
  });
};

export const logoutAllSessions = async (
  userId: string,
  currentSessionId: string,
  metadata: SessionMetadata,
): Promise<void> => {
  const revokedSessionCount = await revokeAllActiveSessions(userId);
  await auditSafely({
    action: AUTH_AUDIT_ACTION.logoutAll,
    actorId: userId,
    entityId: currentSessionId,
    metadata: { revokedSessionCount },
    ...metadata,
  });
};

export const getCurrentUser = async (userId: string): Promise<CurrentUserResponse> => {
  const user = await findCurrentUserById(userId);
  if (!user) {
    throw invalidAccessTokenError();
  }
  return user;
};
