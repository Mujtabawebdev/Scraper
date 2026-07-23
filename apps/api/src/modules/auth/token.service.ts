import { randomUUID } from "node:crypto";

import { jwtVerify, SignJWT } from "jose";

import { env } from "../../config/env.js";
import { UserRole } from "../../generated/prisma/enums.js";
import {
  ACCESS_TOKEN_TYPE,
  AUTH_ALGORITHM,
  AUTH_AUDIENCE,
  AUTH_ISSUER,
  durationToSeconds,
  REFRESH_TOKEN_TYPE,
} from "./auth.constants.js";
import { invalidAccessTokenError, invalidRefreshTokenError } from "./auth.errors.js";
import type {
  AccessTokenClaims,
  RefreshTokenClaims,
  TokenPair,
} from "./auth.types.js";

const encoder = new TextEncoder();
const accessSecret = encoder.encode(env.JWT_ACCESS_SECRET);
const refreshSecret = encoder.encode(env.JWT_REFRESH_SECRET);

export const accessTokenExpiresIn = durationToSeconds(env.JWT_ACCESS_EXPIRES_IN);
export const refreshTokenExpiresIn = durationToSeconds(env.JWT_REFRESH_EXPIRES_IN);

const isUserRole = (value: unknown): value is AccessTokenClaims["role"] =>
  typeof value === "string" && Object.values(UserRole).some((role) => role === value);

export const createTokenPair = async (
  userId: string,
  role: AccessTokenClaims["role"],
  sessionId: string,
): Promise<TokenPair> => {
  const refreshTokenId = randomUUID();
  const [accessToken, refreshToken] = await Promise.all([
    new SignJWT({ role, sessionId, tokenType: ACCESS_TOKEN_TYPE })
      .setProtectedHeader({ alg: AUTH_ALGORITHM, typ: "JWT" })
      .setIssuer(AUTH_ISSUER)
      .setAudience(AUTH_AUDIENCE)
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime(env.JWT_ACCESS_EXPIRES_IN)
      .sign(accessSecret),
    new SignJWT({ sessionId, tokenType: REFRESH_TOKEN_TYPE })
      .setProtectedHeader({ alg: AUTH_ALGORITHM, typ: "JWT" })
      .setIssuer(AUTH_ISSUER)
      .setAudience(AUTH_AUDIENCE)
      .setSubject(userId)
      .setJti(refreshTokenId)
      .setIssuedAt()
      .setExpirationTime(env.JWT_REFRESH_EXPIRES_IN)
      .sign(refreshSecret),
  ]);

  return {
    accessToken,
    refreshToken,
    accessTokenExpiresIn,
    refreshTokenExpiresAt: new Date(Date.now() + refreshTokenExpiresIn * 1_000),
  };
};

export const verifyAccessToken = async (token: string): Promise<AccessTokenClaims> => {
  try {
    const { payload } = await jwtVerify(token, accessSecret, {
      algorithms: [AUTH_ALGORITHM],
      issuer: AUTH_ISSUER,
      audience: AUTH_AUDIENCE,
    });

    if (
      payload.tokenType !== ACCESS_TOKEN_TYPE ||
      typeof payload.sub !== "string" ||
      typeof payload.sessionId !== "string" ||
      !isUserRole(payload.role)
    ) {
      throw invalidAccessTokenError();
    }

    return {
      userId: payload.sub,
      role: payload.role,
      sessionId: payload.sessionId,
      tokenType: ACCESS_TOKEN_TYPE,
    };
  } catch {
    throw invalidAccessTokenError();
  }
};

export const verifyRefreshToken = async (token: string): Promise<RefreshTokenClaims> => {
  try {
    const { payload } = await jwtVerify(token, refreshSecret, {
      algorithms: [AUTH_ALGORITHM],
      issuer: AUTH_ISSUER,
      audience: AUTH_AUDIENCE,
    });

    if (
      payload.tokenType !== REFRESH_TOKEN_TYPE ||
      typeof payload.sub !== "string" ||
      typeof payload.sessionId !== "string" ||
      typeof payload.jti !== "string"
    ) {
      throw invalidRefreshTokenError();
    }

    return {
      userId: payload.sub,
      sessionId: payload.sessionId,
      tokenType: REFRESH_TOKEN_TYPE,
      tokenId: payload.jti,
    };
  } catch {
    throw invalidRefreshTokenError();
  }
};
