import { AppError } from "../../common/errors/app-error.js";

export type AuthErrorCode =
  | "EMAIL_ALREADY_IN_USE"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_SUSPENDED"
  | "ACCOUNT_DISABLED"
  | "AUTHENTICATION_REQUIRED"
  | "INVALID_ACCESS_TOKEN"
  | "INVALID_REFRESH_TOKEN"
  | "REFRESH_TOKEN_REUSE_DETECTED"
  | "INSUFFICIENT_PERMISSIONS";

export class AuthError extends AppError {
  declare readonly code: AuthErrorCode;

  constructor(statusCode: number, code: AuthErrorCode, message: string) {
    super(statusCode, code, message);
    this.name = "AuthError";
  }
}

export const emailAlreadyInUseError = (): AuthError =>
  new AuthError(409, "EMAIL_ALREADY_IN_USE", "An account with this email already exists");

export const invalidCredentialsError = (): AuthError =>
  new AuthError(401, "INVALID_CREDENTIALS", "Invalid email or password");

export const accountSuspendedError = (): AuthError =>
  new AuthError(403, "ACCOUNT_SUSPENDED", "This account is suspended");

export const accountDisabledError = (): AuthError =>
  new AuthError(403, "ACCOUNT_DISABLED", "This account is disabled");

export const authenticationRequiredError = (): AuthError =>
  new AuthError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");

export const invalidAccessTokenError = (): AuthError =>
  new AuthError(401, "INVALID_ACCESS_TOKEN", "The access token is invalid or expired");

export const invalidRefreshTokenError = (): AuthError =>
  new AuthError(401, "INVALID_REFRESH_TOKEN", "The refresh token is invalid or expired");

export const refreshTokenReuseError = (): AuthError =>
  new AuthError(
    401,
    "REFRESH_TOKEN_REUSE_DETECTED",
    "Refresh token reuse was detected; all sessions have been revoked",
  );

export const insufficientPermissionsError = (): AuthError =>
  new AuthError(403, "INSUFFICIENT_PERMISSIONS", "You do not have permission to perform this action");
