import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import type { UserRole } from "../../generated/prisma/enums.js";
import type { SessionMetadata, TokenPair } from "./auth.types.js";
import { createTokenPair } from "./token.service.js";

export type PreparedSession = {
  id: string;
  refreshTokenHash: string;
  expiresAt: Date;
  metadata: SessionMetadata;
  tokens: TokenPair;
};

export const hashRefreshToken = (refreshToken: string): string =>
  createHash("sha256").update(refreshToken, "utf8").digest("hex");

export const refreshTokenMatchesHash = (
  refreshTokenHash: string,
  refreshToken: string,
): boolean => {
  const expectedHash = hashRefreshToken(refreshToken);
  const stored = Buffer.from(refreshTokenHash.trim(), "utf8");
  const expected = Buffer.from(expectedHash, "utf8");
  return stored.length === expected.length && timingSafeEqual(stored, expected);
};

export const prepareSession = async (
  userId: string,
  role: UserRole,
  metadata: SessionMetadata,
): Promise<PreparedSession> => {
  const id = randomUUID();
  const tokens = await createTokenPair(userId, role, id);
  return {
    id,
    refreshTokenHash: hashRefreshToken(tokens.refreshToken),
    expiresAt: tokens.refreshTokenExpiresAt,
    metadata,
    tokens,
  };
};
