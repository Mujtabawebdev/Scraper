export const AUTH_ISSUER = "lead-saas-api";
export const AUTH_AUDIENCE = "lead-saas-client";
export const ACCESS_TOKEN_TYPE = "access";
export const REFRESH_TOKEN_TYPE = "refresh";
export const AUTH_ALGORITHM = "HS256";
export const SYSTEM_USER_EMAIL = "system@lead-saas.local";
export const NON_LOGIN_PASSWORD_HASH = "NON_LOGIN_SYSTEM_ACCOUNT";

export const AUTH_AUDIT_ACTION = {
  registerSuccess: "AUTH_REGISTER_SUCCESS",
  loginSuccess: "AUTH_LOGIN_SUCCESS",
  loginFailed: "AUTH_LOGIN_FAILED",
  refreshSuccess: "AUTH_REFRESH_SUCCESS",
  refreshReuseDetected: "AUTH_REFRESH_REUSE_DETECTED",
  logout: "AUTH_LOGOUT",
  logoutAll: "AUTH_LOGOUT_ALL",
} as const;

const DURATION_MULTIPLIERS = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
} as const;

export const durationToSeconds = (duration: string): number => {
  const match = /^([1-9]\d*)([smhd])$/.exec(duration);
  if (!match?.[1] || !match[2]) {
    throw new Error("INVALID_AUTH_DURATION");
  }

  const unit = match[2] as keyof typeof DURATION_MULTIPLIERS;
  const seconds = Number(match[1]) * DURATION_MULTIPLIERS[unit];
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new Error("INVALID_AUTH_DURATION");
  }
  return seconds;
};
