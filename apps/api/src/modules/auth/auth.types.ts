import type { UserRole, UserStatus } from "../../generated/prisma/enums.js";
import type { z } from "zod";

import type { loginSchema, registerSchema } from "./auth.schemas.js";

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export type SessionMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

export type AuthContext = {
  userId: string;
  role: UserRole;
  sessionId: string;
};

export type AccessTokenClaims = AuthContext & {
  tokenType: "access";
};

export type RefreshTokenClaims = {
  userId: string;
  sessionId: string;
  tokenType: "refresh";
  tokenId: string;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
  refreshTokenExpiresAt: Date;
};

export type RegisterUserResponse = {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
};

export type CurrentUserResponse = RegisterUserResponse & {
  lastLoginAt: Date | null;
  updatedAt: Date;
};

export type AuthenticationResult = {
  user: RegisterUserResponse;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
};

export type RefreshResult = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: number;
};
