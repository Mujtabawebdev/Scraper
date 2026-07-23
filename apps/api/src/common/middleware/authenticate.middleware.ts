import type { RequestHandler } from "express";

import {
  AuthError,
  accountDisabledError,
  accountSuspendedError,
  authenticationRequiredError,
  invalidAccessTokenError,
} from "../../modules/auth/auth.errors.js";
import { findActiveSessionUser } from "../../modules/auth/auth.repository.js";
import { verifyAccessToken } from "../../modules/auth/token.service.js";
import type { AccessTokenClaims } from "../../modules/auth/auth.types.js";

export const authenticate: RequestHandler = async (request, _response, next) => {
  const authorization = request.get("authorization");
  if (!authorization) {
    next(authenticationRequiredError());
    return;
  }

  const [scheme, token, extra] = authorization.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token || extra) {
    next(invalidAccessTokenError());
    return;
  }

  let claims: AccessTokenClaims;
  try {
    claims = await verifyAccessToken(token);
  } catch (error: unknown) {
    next(error instanceof AuthError ? error : invalidAccessTokenError());
    return;
  }

  const session = await findActiveSessionUser(claims.sessionId, claims.userId);
  if (!session) {
    next(invalidAccessTokenError());
    return;
  }
  if (session.user.status === "SUSPENDED") {
    next(accountSuspendedError());
    return;
  }
  if (session.user.status === "DISABLED") {
    next(accountDisabledError());
    return;
  }

  request.auth = {
    userId: session.user.id,
    role: session.user.role,
    sessionId: claims.sessionId,
  };
  next();
};
