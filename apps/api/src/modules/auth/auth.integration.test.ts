import { randomUUID } from "node:crypto";

import cookieParser from "cookie-parser";
import express from "express";
import { SignJWT } from "jose";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { authorizeRoles } from "../../common/middleware/authorize.middleware.js";
import { authenticate } from "../../common/middleware/authenticate.middleware.js";
import { errorHandler } from "../../common/middleware/error.middleware.js";
import { env } from "../../config/env.js";
import type {
  UserRole,
  UserStatus,
} from "../../generated/prisma/enums.js";
import {
  disconnectDatabase,
  prisma,
} from "../../infrastructure/database/prisma.js";
import {
  AUTH_ALGORITHM,
  AUTH_AUDIENCE,
  AUTH_ISSUER,
} from "./auth.constants.js";
import { authRouter } from "./auth.routes.js";
import { hashPassword } from "./password.service.js";

const TEST_EMAIL_PREFIX = "phase5-auth-test-";
const TEST_PASSWORD = "StrongPassword123!";
const AUTH_BASE_PATH = "/api/v1/auth";

type JsonRecord = Record<string, unknown>;

type MinimalTestResponse = {
  body: unknown;
  headers: Record<string, unknown>;
  status: number;
};

type CreateTestUserOptions = {
  email?: string;
  role?: UserRole;
  status?: UserStatus;
};

const testApp = express();
testApp.use(express.json({ limit: "1mb" }));
testApp.use(cookieParser());
testApp.use(AUTH_BASE_PATH, authRouter);
testApp.get(
  "/__auth-test/admin",
  authenticate,
  authorizeRoles("ADMIN", "SUPER_ADMIN"),
  (_request, response) => {
    response.status(200).json({
      success: true,
      message: "Authorized for auth middleware test",
    });
  },
);
testApp.use(errorHandler);

let reusablePasswordHash = "";
let safeTestDatabase = false;

const asRecord = (value: unknown, label: string): JsonRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as JsonRecord;
};

const readString = (record: JsonRecord, key: string): string => {
  const value = record[key];
  if (typeof value !== "string") {
    throw new TypeError(`${key} must be a string`);
  }
  return value;
};

const responseBody = (response: MinimalTestResponse): JsonRecord =>
  asRecord(response.body, "response body");

const responseData = (response: MinimalTestResponse): JsonRecord =>
  asRecord(responseBody(response).data, "response data");

const responseUser = (response: MinimalTestResponse): JsonRecord =>
  asRecord(responseData(response).user, "response user");

const responseAccessToken = (response: MinimalTestResponse): string =>
  readString(responseData(response), "accessToken");

const responseErrorCode = (response: MinimalTestResponse): string =>
  readString(
    asRecord(responseBody(response).error, "response error"),
    "code",
  );

const responseMessage = (response: MinimalTestResponse): string =>
  readString(responseBody(response), "message");

const getSetCookieHeaders = (response: MinimalTestResponse): string[] => {
  const header = response.headers["set-cookie"];
  if (typeof header === "string") {
    return [header];
  }
  if (
    Array.isArray(header) &&
    header.every((value) => typeof value === "string")
  ) {
    return header;
  }
  return [];
};

const getRefreshSetCookie = (response: MinimalTestResponse): string => {
  const cookie = getSetCookieHeaders(response).find((value) =>
    value.startsWith(`${env.AUTH_COOKIE_NAME}=`),
  );
  if (!cookie) {
    throw new Error("Refresh Set-Cookie header is missing");
  }
  return cookie;
};

const getCookiePair = (setCookie: string): string => {
  const pair = setCookie.split(";", 1)[0];
  if (!pair) {
    throw new Error("Set-Cookie header does not contain a cookie pair");
  }
  return pair;
};

const getRefreshTokenFromCookie = (setCookie: string): string => {
  const pair = getCookiePair(setCookie);
  const prefix = `${env.AUTH_COOKIE_NAME}=`;
  if (!pair.startsWith(prefix)) {
    throw new Error("Unexpected refresh cookie name");
  }
  return decodeURIComponent(pair.slice(prefix.length));
};

const expectNoSensitiveJson = (response: MinimalTestResponse): void => {
  const serialized = JSON.stringify(response.body);
  expect(serialized).not.toContain("passwordHash");
  expect(serialized).not.toContain("refreshToken");
  expect(serialized).not.toContain("refreshTokenHash");
};

const uniqueEmail = (label: string): string =>
  `${TEST_EMAIL_PREFIX}${label}-${randomUUID()}@example.com`;

const cleanupAuthTestData = async (): Promise<void> => {
  await prisma.auditLog.deleteMany({
    where: { entityType: "AUTH_SESSION" },
  });
  await prisma.userSession.deleteMany({
    where: {
      user: {
        email: { startsWith: TEST_EMAIL_PREFIX },
      },
    },
  });
  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_EMAIL_PREFIX } },
  });
};

const createTestUser = async (
  options: CreateTestUserOptions = {},
) =>
  prisma.user.create({
    data: {
      email: options.email ?? uniqueEmail("fixture"),
      fullName: "Auth Test User",
      passwordHash: reusablePasswordHash,
      role: options.role ?? "USER",
      status: options.status ?? "ACTIVE",
    },
  });

const register = async (
  email: string,
  extraBody: JsonRecord = {},
) =>
  request(testApp)
    .post(`${AUTH_BASE_PATH}/register`)
    .send({
      fullName: "John Smith",
      email,
      password: TEST_PASSWORD,
      ...extraBody,
    });

const login = async (email: string, password = TEST_PASSWORD) =>
  request(testApp)
    .post(`${AUTH_BASE_PATH}/login`)
    .send({ email, password });

beforeAll(async () => {
  if (env.NODE_ENV !== "test") {
    throw new Error("Refusing to run auth integration tests unless NODE_ENV is test");
  }
  const databaseName = decodeURIComponent(
    new URL(env.DATABASE_URL).pathname.replace(/^\/+/, ""),
  );
  if (!databaseName.endsWith("_auth_test")) {
    throw new Error("Refusing to run auth integration tests outside the auth-test database");
  }
  safeTestDatabase = true;
  reusablePasswordHash = await hashPassword(TEST_PASSWORD);
});

beforeEach(async () => {
  if (safeTestDatabase) {
    await cleanupAuthTestData();
  }
});

afterAll(async () => {
  if (safeTestDatabase) {
    await cleanupAuthTestData();
  }
  await disconnectDatabase();
});

describe("POST /api/v1/auth/register", () => {
  it("registers a normalized user without exposing secrets and sets an HttpOnly cookie", async () => {
    const email = uniqueEmail("register");
    const response = await request(testApp)
      .post(`${AUTH_BASE_PATH}/register`)
      .send({
        fullName: "  John    Smith  ",
        email: email.toUpperCase(),
        password: TEST_PASSWORD,
      });

    expect(response.status).toBe(201);
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(responseMessage(response)).toBe("Account created successfully");
    expect(responseAccessToken(response)).toEqual(expect.any(String));
    expect(responseData(response).accessTokenExpiresIn).toBe(900);
    expect(responseUser(response)).toMatchObject({
      fullName: "John Smith",
      email,
      role: "USER",
      status: "ACTIVE",
    });
    expect(Object.keys(responseUser(response)).sort()).toEqual(
      ["createdAt", "email", "fullName", "id", "role", "status"].sort(),
    );
    expectNoSensitiveJson(response);

    const setCookie = getRefreshSetCookie(response);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");
    expect(setCookie).toContain("Path=/api/v1/auth");
    expect(setCookie).not.toContain("Secure");

    const storedUser = await prisma.user.findUnique({
      where: { email },
      include: { sessions: true },
    });
    expect(storedUser).not.toBeNull();
    expect(storedUser?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(storedUser?.sessions).toHaveLength(1);

    const storedSession = storedUser?.sessions[0];
    expect(storedSession?.refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(storedSession?.refreshTokenHash).not.toBe(
      getRefreshTokenFromCookie(setCookie),
    );
  });

  it("rejects a duplicate normalized email", async () => {
    const email = uniqueEmail("duplicate");
    expect((await register(email)).status).toBe(201);

    const duplicate = await register(email.toUpperCase());

    expect(duplicate.status).toBe(409);
    expect(responseErrorCode(duplicate)).toBe("EMAIL_ALREADY_IN_USE");
  });

  it("rejects a weak registration password with validation details", async () => {
    const response = await request(testApp)
      .post(`${AUTH_BASE_PATH}/register`)
      .send({
        fullName: "Weak Password",
        email: uniqueEmail("weak"),
        password: "weak",
      });

    expect(response.status).toBe(400);
    expect(responseErrorCode(response)).toBe("VALIDATION_ERROR");
    expect(
      asRecord(responseBody(response).error, "response error").issues,
    ).toEqual(expect.any(Array));
  });

  it("rejects unknown registration fields", async () => {
    const response = await register(uniqueEmail("unknown-field"), {
      role: "SUPER_ADMIN",
    });

    expect(response.status).toBe(400);
    expect(responseErrorCode(response)).toBe("VALIDATION_ERROR");
  });
});

describe("POST /api/v1/auth/login", () => {
  it("logs in an active user, updates last login, and returns no stored secrets", async () => {
    const email = uniqueEmail("login-success");
    await createTestUser({ email });

    const response = await login(email.toUpperCase());

    expect(response.status).toBe(200);
    expect(responseMessage(response)).toBe("Logged in successfully");
    expect(responseAccessToken(response)).toEqual(expect.any(String));
    expect(responseUser(response)).toMatchObject({ email, role: "USER" });
    expect(getRefreshSetCookie(response)).toContain("HttpOnly");
    expectNoSensitiveJson(response);

    const storedUser = await prisma.user.findUnique({ where: { email } });
    expect(storedUser?.lastLoginAt).toBeInstanceOf(Date);
  });

  it("uses the same generic failure for an unknown email and a wrong password", async () => {
    const email = uniqueEmail("wrong-password");
    await createTestUser({ email });

    const [unknownEmailResponse, wrongPasswordResponse] = await Promise.all([
      login(uniqueEmail("unknown-login")),
      login(email, "IncorrectPassword123!"),
    ]);

    for (const response of [unknownEmailResponse, wrongPasswordResponse]) {
      expect(response.status).toBe(401);
      expect(responseMessage(response)).toBe("Invalid email or password");
      expect(responseErrorCode(response)).toBe("INVALID_CREDENTIALS");
    }
  });

  it("rejects a suspended account after valid password verification", async () => {
    const email = uniqueEmail("suspended");
    await createTestUser({ email, status: "SUSPENDED" });

    const response = await login(email);

    expect(response.status).toBe(403);
    expect(responseErrorCode(response)).toBe("ACCOUNT_SUSPENDED");
  });
});

describe("POST /api/v1/auth/refresh", () => {
  it("rotates the cookie and atomically links the old and replacement sessions", async () => {
    const email = uniqueEmail("rotation");
    const registered = await register(email);
    const oldSetCookie = getRefreshSetCookie(registered);
    const oldCookie = getCookiePair(oldSetCookie);
    const oldAccessToken = responseAccessToken(registered);

    const user = await prisma.user.findUnique({
      where: { email },
      include: { sessions: true },
    });
    const oldSession = user?.sessions[0];
    if (!oldSession) {
      throw new Error("Registration did not create the initial session");
    }

    const refreshed = await request(testApp)
      .post(`${AUTH_BASE_PATH}/refresh`)
      .set("Cookie", oldCookie)
      .send({});

    expect(refreshed.status).toBe(200);
    expect(responseMessage(refreshed)).toBe(
      "Access token refreshed successfully",
    );
    expect(responseAccessToken(refreshed)).not.toBe(oldAccessToken);
    expectNoSensitiveJson(refreshed);

    const replacementSetCookie = getRefreshSetCookie(refreshed);
    expect(getCookiePair(replacementSetCookie)).not.toBe(oldCookie);
    expect(replacementSetCookie).toContain("HttpOnly");

    const consumedSession = await prisma.userSession.findUnique({
      where: { id: oldSession.id },
    });
    expect(consumedSession?.revokedAt).toBeInstanceOf(Date);
    expect(consumedSession?.lastUsedAt).toBeInstanceOf(Date);
    expect(consumedSession?.replacedBySessionId).toEqual(expect.any(String));

    const replacementSession = consumedSession?.replacedBySessionId
      ? await prisma.userSession.findUnique({
          where: { id: consumedSession.replacedBySessionId },
        })
      : null;
    expect(replacementSession).not.toBeNull();
    expect(replacementSession?.revokedAt).toBeNull();
    expect(replacementSession?.refreshTokenHash).not.toBe(
      getRefreshTokenFromCookie(replacementSetCookie),
    );
  });

  it("rejects an already revoked refresh token and clears its cookie", async () => {
    const email = uniqueEmail("revoked");
    const registered = await register(email);
    const cookie = getCookiePair(getRefreshSetCookie(registered));
    const user = await prisma.user.findUnique({
      where: { email },
      include: { sessions: true },
    });
    const session = user?.sessions[0];
    if (!session) {
      throw new Error("Registration did not create the initial session");
    }
    await prisma.userSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const response = await request(testApp)
      .post(`${AUTH_BASE_PATH}/refresh`)
      .set("Cookie", cookie)
      .send({});

    expect(response.status).toBe(401);
    expect(responseErrorCode(response)).toBe(
      "REFRESH_TOKEN_REUSE_DETECTED",
    );
    expect(getRefreshSetCookie(response)).toContain(
      `${env.AUTH_COOKIE_NAME}=;`,
    );
  });

  it("detects rotated-token reuse and revokes every active user session", async () => {
    const email = uniqueEmail("reuse");
    const registered = await register(email);
    const oldCookie = getCookiePair(getRefreshSetCookie(registered));
    expect((await login(email)).status).toBe(200);

    const rotation = await request(testApp)
      .post(`${AUTH_BASE_PATH}/refresh`)
      .set("Cookie", oldCookie)
      .send({});
    expect(rotation.status).toBe(200);

    const replay = await request(testApp)
      .post(`${AUTH_BASE_PATH}/refresh`)
      .set("Cookie", oldCookie)
      .send({});

    expect(replay.status).toBe(401);
    expect(responseErrorCode(replay)).toBe(
      "REFRESH_TOKEN_REUSE_DETECTED",
    );

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error("Reuse test user is missing");
    }
    expect(
      await prisma.userSession.count({
        where: { userId: user.id, revokedAt: null },
      }),
    ).toBe(0);
    expect(
      await prisma.auditLog.count({
        where: {
          actorId: user.id,
          action: "AUTH_REFRESH_REUSE_DETECTED",
        },
      }),
    ).toBe(1);
  });
});

describe("logout endpoints", () => {
  it("revokes the matching session and clears the refresh cookie", async () => {
    const email = uniqueEmail("logout");
    const registered = await register(email);
    const cookie = getCookiePair(getRefreshSetCookie(registered));
    const user = await prisma.user.findUnique({
      where: { email },
      include: { sessions: true },
    });
    const session = user?.sessions[0];
    if (!session) {
      throw new Error("Logout test session is missing");
    }

    const response = await request(testApp)
      .post(`${AUTH_BASE_PATH}/logout`)
      .set("Cookie", cookie)
      .send({});

    expect(response.status).toBe(200);
    expect(responseMessage(response)).toBe("Logged out successfully");
    expect(getRefreshSetCookie(response)).toContain(
      `${env.AUTH_COOKIE_NAME}=;`,
    );
    expect(
      (await prisma.userSession.findUnique({ where: { id: session.id } }))
        ?.revokedAt,
    ).toBeInstanceOf(Date);
  });

  it("keeps logout idempotent for absent and malformed cookies", async () => {
    const absent = await request(testApp)
      .post(`${AUTH_BASE_PATH}/logout`)
      .send({});
    const malformed = await request(testApp)
      .post(`${AUTH_BASE_PATH}/logout`)
      .set("Cookie", `${env.AUTH_COOKIE_NAME}=not-a-jwt`)
      .send({});

    expect(absent.status).toBe(200);
    expect(malformed.status).toBe(200);
    expect(responseMessage(absent)).toBe("Logged out successfully");
    expect(responseMessage(malformed)).toBe("Logged out successfully");
  });

  it("revokes all sessions and invalidates their access tokens", async () => {
    const email = uniqueEmail("logout-all");
    const registered = await register(email);
    const firstAccessToken = responseAccessToken(registered);
    const firstCookie = getCookiePair(getRefreshSetCookie(registered));
    expect((await login(email)).status).toBe(200);

    const response = await request(testApp)
      .post(`${AUTH_BASE_PATH}/logout-all`)
      .set("Authorization", `Bearer ${firstAccessToken}`)
      .set("Cookie", firstCookie)
      .send({});

    expect(response.status).toBe(200);
    expect(responseMessage(response)).toBe(
      "Logged out from all devices successfully",
    );
    expect(getRefreshSetCookie(response)).toContain(
      `${env.AUTH_COOKIE_NAME}=;`,
    );

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error("Logout-all test user is missing");
    }
    expect(
      await prisma.userSession.count({
        where: { userId: user.id, revokedAt: null },
      }),
    ).toBe(0);

    const meAfterLogout = await request(testApp)
      .get(`${AUTH_BASE_PATH}/me`)
      .set("Authorization", `Bearer ${firstAccessToken}`);
    expect(meAfterLogout.status).toBe(401);
    expect(responseErrorCode(meAfterLogout)).toBe("INVALID_ACCESS_TOKEN");
  });
});

describe("GET /api/v1/auth/me", () => {
  it("returns only the current active user's public authentication fields", async () => {
    const email = uniqueEmail("me");
    const registered = await register(email);

    const response = await request(testApp)
      .get(`${AUTH_BASE_PATH}/me`)
      .set(
        "Authorization",
        `Bearer ${responseAccessToken(registered)}`,
      );

    expect(response.status).toBe(200);
    expect(responseMessage(response)).toBe(
      "Current user fetched successfully",
    );
    expect(responseUser(response)).toMatchObject({
      email,
      fullName: "John Smith",
      role: "USER",
      status: "ACTIVE",
      lastLoginAt: null,
    });
    expect(Object.keys(responseUser(response)).sort()).toEqual(
      [
        "createdAt",
        "email",
        "fullName",
        "id",
        "lastLoginAt",
        "role",
        "status",
        "updatedAt",
      ].sort(),
    );
    expectNoSensitiveJson(response);
  });

  it("rejects a missing Authorization header", async () => {
    const response = await request(testApp).get(`${AUTH_BASE_PATH}/me`);

    expect(response.status).toBe(401);
    expect(responseErrorCode(response)).toBe("AUTHENTICATION_REQUIRED");
  });

  it("rejects an invalid access token", async () => {
    const response = await request(testApp)
      .get(`${AUTH_BASE_PATH}/me`)
      .set("Authorization", "Bearer invalid-access-token");

    expect(response.status).toBe(401);
    expect(responseErrorCode(response)).toBe("INVALID_ACCESS_TOKEN");
  });

  it("rejects a correctly signed but expired access token", async () => {
    const email = uniqueEmail("expired");
    const registered = await register(email);
    const user = await prisma.user.findUnique({
      where: { email },
      include: { sessions: true },
    });
    const session = user?.sessions[0];
    if (!user || !session) {
      throw new Error("Expired-token test setup is incomplete");
    }

    const now = Math.floor(Date.now() / 1_000);
    const expiredToken = await new SignJWT({
      role: "USER",
      sessionId: session.id,
      tokenType: "access",
    })
      .setProtectedHeader({ alg: AUTH_ALGORITHM, typ: "JWT" })
      .setIssuer(AUTH_ISSUER)
      .setAudience(AUTH_AUDIENCE)
      .setSubject(user.id)
      .setIssuedAt(now - 120)
      .setExpirationTime(now - 60)
      .sign(new TextEncoder().encode(env.JWT_ACCESS_SECRET));

    const response = await request(testApp)
      .get(`${AUTH_BASE_PATH}/me`)
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
    expect(responseErrorCode(response)).toBe("INVALID_ACCESS_TOKEN");
    expect(responseAccessToken(registered)).toEqual(expect.any(String));
  });
});

describe("authorizeRoles", () => {
  it("allows an authenticated user with an allowed role", async () => {
    const email = uniqueEmail("admin");
    await createTestUser({ email, role: "ADMIN" });
    const authenticated = await login(email);

    const response = await request(testApp)
      .get("/__auth-test/admin")
      .set(
        "Authorization",
        `Bearer ${responseAccessToken(authenticated)}`,
      );

    expect(response.status).toBe(200);
    expect(responseMessage(response)).toBe(
      "Authorized for auth middleware test",
    );
  });

  it("rejects an authenticated user without an allowed role", async () => {
    const registered = await register(uniqueEmail("role-rejected"));

    const response = await request(testApp)
      .get("/__auth-test/admin")
      .set(
        "Authorization",
        `Bearer ${responseAccessToken(registered)}`,
      );

    expect(response.status).toBe(403);
    expect(responseErrorCode(response)).toBe(
      "INSUFFICIENT_PERMISSIONS",
    );
  });
});
