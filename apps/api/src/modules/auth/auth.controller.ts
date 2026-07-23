import type { Request, Response } from "express";

import {
  clearRefreshCookie,
  readRefreshCookie,
  setRefreshCookie,
} from "./auth.cookies.js";
import { AuthError, authenticationRequiredError, invalidRefreshTokenError } from "./auth.errors.js";
import {
  getCurrentUser,
  loginUser,
  logoutAllSessions,
  logoutSession,
  refreshAuthentication,
  registerUser,
} from "./auth.service.js";
import type { LoginInput, RegisterInput, SessionMetadata } from "./auth.types.js";

const getSessionMetadata = (request: Request): SessionMetadata => {
  const userAgent = request.get("user-agent");
  return {
    ...(request.ip ? { ipAddress: request.ip } : {}),
    ...(userAgent ? { userAgent: userAgent.slice(0, 2_048) } : {}),
  };
};

export const register = async (
  request: Request<Record<string, string>, unknown, RegisterInput>,
  response: Response,
): Promise<void> => {
  const result = await registerUser(request.body, getSessionMetadata(request));
  setRefreshCookie(response, result.refreshToken);
  response.status(201).json({
    success: true,
    message: "Account created successfully",
    data: {
      user: result.user,
      accessToken: result.accessToken,
      accessTokenExpiresIn: result.accessTokenExpiresIn,
    },
  });
};

export const login = async (
  request: Request<Record<string, string>, unknown, LoginInput>,
  response: Response,
): Promise<void> => {
  const result = await loginUser(request.body, getSessionMetadata(request));
  setRefreshCookie(response, result.refreshToken);
  response.status(200).json({
    success: true,
    message: "Logged in successfully",
    data: {
      user: result.user,
      accessToken: result.accessToken,
      accessTokenExpiresIn: result.accessTokenExpiresIn,
    },
  });
};

export const refresh = async (request: Request, response: Response): Promise<void> => {
  const refreshToken = readRefreshCookie(request);
  if (!refreshToken) {
    clearRefreshCookie(response);
    throw invalidRefreshTokenError();
  }

  try {
    const result = await refreshAuthentication(refreshToken, getSessionMetadata(request));
    setRefreshCookie(response, result.refreshToken);
    response.status(200).json({
      success: true,
      message: "Access token refreshed successfully",
      data: {
        accessToken: result.accessToken,
        accessTokenExpiresIn: result.accessTokenExpiresIn,
      },
    });
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      clearRefreshCookie(response);
    }
    throw error;
  }
};

export const logout = async (request: Request, response: Response): Promise<void> => {
  const refreshToken = readRefreshCookie(request);
  await logoutSession(refreshToken, getSessionMetadata(request));
  clearRefreshCookie(response);
  response.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
};

export const logoutAll = async (request: Request, response: Response): Promise<void> => {
  if (!request.auth) {
    throw authenticationRequiredError();
  }
  await logoutAllSessions(
    request.auth.userId,
    request.auth.sessionId,
    getSessionMetadata(request),
  );
  clearRefreshCookie(response);
  response.status(200).json({
    success: true,
    message: "Logged out from all devices successfully",
  });
};

export const me = async (request: Request, response: Response): Promise<void> => {
  if (!request.auth) {
    throw authenticationRequiredError();
  }
  const user = await getCurrentUser(request.auth.userId);
  response.status(200).json({
    success: true,
    message: "Current user fetched successfully",
    data: { user },
  });
};
