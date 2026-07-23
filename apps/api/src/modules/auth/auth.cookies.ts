import type { CookieOptions, Request, Response } from "express";

import { env } from "../../config/env.js";
import { refreshTokenExpiresIn } from "./token.service.js";

const baseCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.AUTH_COOKIE_SECURE,
  sameSite: env.AUTH_COOKIE_SAME_SITE,
  path: env.AUTH_COOKIE_PATH,
  ...(env.AUTH_COOKIE_DOMAIN ? { domain: env.AUTH_COOKIE_DOMAIN } : {}),
});

export const setRefreshCookie = (response: Response, refreshToken: string): void => {
  response.cookie(env.AUTH_COOKIE_NAME, refreshToken, {
    ...baseCookieOptions(),
    maxAge: refreshTokenExpiresIn * 1_000,
  });
};

export const clearRefreshCookie = (response: Response): void => {
  response.clearCookie(env.AUTH_COOKIE_NAME, baseCookieOptions());
};

export const readRefreshCookie = (request: Request): string | undefined => {
  const cookies: unknown = request.cookies;
  if (typeof cookies !== "object" || cookies === null) {
    return undefined;
  }

  const value = (cookies as Record<string, unknown>)[env.AUTH_COOKIE_NAME];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};
