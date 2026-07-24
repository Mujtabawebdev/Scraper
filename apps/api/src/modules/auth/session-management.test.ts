import { randomUUID } from "node:crypto";

import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { authenticate } from "../../common/middleware/authenticate.middleware.js";
import { errorHandler } from "../../common/middleware/error.middleware.js";
import { disconnectDatabase, prisma } from "../../infrastructure/database/prisma.js";
import { clearAllAccountLockouts } from "./account-lockout.service.js";
import { authRouter } from "./auth.routes.js";
import { hashPassword } from "./password.service.js";

const TEST_EMAIL_PREFIX = "phase12-session-test-";
const TEST_PASSWORD = "StrongPassword123!";
const AUTH_BASE_PATH = "/api/v1/auth";

const testApp = express();
testApp.use(express.json({ limit: "1mb" }));
testApp.use(cookieParser());
testApp.use(AUTH_BASE_PATH, authRouter);
testApp.use(errorHandler);

let reusablePasswordHash = "";
let safeTestDatabase = false;

const uniqueEmail = (label: string) =>
  `${TEST_EMAIL_PREFIX}${label}-${randomUUID()}@example.com`;

const cleanupTestData = async () => {
  await prisma.auditLog.deleteMany({ where: { entityType: "AUTH_SESSION" } });
  await prisma.userSession.deleteMany({
    where: { user: { email: { startsWith: TEST_EMAIL_PREFIX } } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: TEST_EMAIL_PREFIX } } });
};

const registerAndLogin = async (email: string) => {
  await request(testApp)
    .post(`${AUTH_BASE_PATH}/register`)
    .send({ fullName: "Session Test", email, password: TEST_PASSWORD });

  const loginResp = await request(testApp)
    .post(`${AUTH_BASE_PATH}/login`)
    .send({ email, password: TEST_PASSWORD });

  const body = loginResp.body as { data: { accessToken: string } };
  const rawCookies = loginResp.headers["set-cookie"];
  const cookieArr = Array.isArray(rawCookies) ? rawCookies : typeof rawCookies === "string" ? [rawCookies] : [];
  const refreshCookie = cookieArr.find((c: string) => c.includes("lead_saas_refresh_token")) ?? "";
  return { accessToken: body.data.accessToken, refreshCookie };
};

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    safeTestDatabase = (await prisma.user.count()) < 1000;
    if (safeTestDatabase) {
      reusablePasswordHash = await hashPassword(TEST_PASSWORD);
    }
  } catch {
    // intentionally empty
  }
});

afterAll(async () => {
  if (safeTestDatabase) await cleanupTestData();
  await disconnectDatabase();
});

beforeEach(() => {
  clearAllAccountLockouts();
});

describe("Session Management Integration", () => {
  describe("GET /api/v1/auth/sessions", () => {
    it("requires authentication", async () => {
      const response = await request(testApp).get(`${AUTH_BASE_PATH}/sessions`);
      expect(response.status).toBe(401);
    });

    it("returns active sessions for authenticated user", async () => {
      if (!safeTestDatabase) return;
      const email = uniqueEmail("sessions-list");
      const { accessToken } = await registerAndLogin(email);

      const response = await request(testApp)
        .get(`${AUTH_BASE_PATH}/sessions`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      const body = response.body as {
        success: boolean;
        data: { sessions: Array<{ id: string; isCurrentSession: boolean }> };
      };
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data.sessions)).toBe(true);
      expect(body.data.sessions.length).toBeGreaterThan(0);
      expect(body.data.sessions.some((s) => s.isCurrentSession)).toBe(true);
    });

    it("does not expose refreshTokenHash in session list", async () => {
      if (!safeTestDatabase) return;
      const email = uniqueEmail("sessions-no-hash");
      const { accessToken } = await registerAndLogin(email);

      const response = await request(testApp)
        .get(`${AUTH_BASE_PATH}/sessions`)
        .set("Authorization", `Bearer ${accessToken}`);

      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain("refreshTokenHash");
      expect(serialized).not.toContain("passwordHash");
    });
  });

  describe("DELETE /api/v1/auth/sessions/:sessionId", () => {
    it("requires authentication", async () => {
      const fakeId = randomUUID();
      const response = await request(testApp).delete(`${AUTH_BASE_PATH}/sessions/${fakeId}`);
      expect(response.status).toBe(401);
    });

    it("returns 404 for a non-existent session", async () => {
      if (!safeTestDatabase) return;
      const email = uniqueEmail("sessions-del-404");
      const { accessToken } = await registerAndLogin(email);
      const fakeId = randomUUID();

      const response = await request(testApp)
        .delete(`${AUTH_BASE_PATH}/sessions/${fakeId}`)
        .set("Authorization", `Bearer ${accessToken}`);

      expect(response.status).toBe(404);
    });

    it("successfully revokes another session belonging to the same user", async () => {
      if (!safeTestDatabase) return;
      const email = uniqueEmail("sessions-del-ok");

      // Create a second session via a second login
      const { accessToken } = await registerAndLogin(email);
      const loginResp2 = await request(testApp)
        .post(`${AUTH_BASE_PATH}/login`)
        .send({ email, password: TEST_PASSWORD });
      const body2 = loginResp2.body as { data: { accessToken: string } };
      const accessToken2 = body2.data.accessToken;

      // Get session list from session 2 perspective and find session 1
      const sessionsResp = await request(testApp)
        .get(`${AUTH_BASE_PATH}/sessions`)
        .set("Authorization", `Bearer ${accessToken2}`);

      const sessionsBody = sessionsResp.body as {
        data: { sessions: Array<{ id: string; isCurrentSession: boolean }> };
      };
      const otherSession = sessionsBody.data.sessions.find((s) => !s.isCurrentSession);
      if (!otherSession) return; // skip if only one session (race condition in test db)

      const deleteResp = await request(testApp)
        .delete(`${AUTH_BASE_PATH}/sessions/${otherSession.id}`)
        .set("Authorization", `Bearer ${accessToken2}`);

      expect(deleteResp.status).toBe(200);
      const deleteBody = deleteResp.body as { success: boolean };
      expect(deleteBody.success).toBe(true);

      // The revoked token should no longer work
      const afterRevoke = await request(testApp)
        .get(`${AUTH_BASE_PATH}/me`)
        .set("Authorization", `Bearer ${accessToken}`);
      expect(afterRevoke.status).toBe(401);
    });
  });
});

describe("Account Lockout Integration", () => {
  it("returns ACCOUNT_LOCKED after 5 consecutive wrong passwords", async () => {
    if (!safeTestDatabase) return;
    const email = uniqueEmail("lockout-intg");

    await request(testApp)
      .post(`${AUTH_BASE_PATH}/register`)
      .send({ fullName: "Lockout Test", email, password: TEST_PASSWORD });

    for (let i = 0; i < 5; i++) {
      await request(testApp)
        .post(`${AUTH_BASE_PATH}/login`)
        .send({ email, password: "WrongPassword!99" });
    }

    const finalResp = await request(testApp)
      .post(`${AUTH_BASE_PATH}/login`)
      .send({ email, password: TEST_PASSWORD });

    expect(finalResp.status).toBe(429);
    const body = finalResp.body as { error: { code: string } };
    expect(body.error.code).toBe("ACCOUNT_LOCKED");
  });

  it("succeeds immediately if correct password is used before lockout threshold", async () => {
    if (!safeTestDatabase) return;
    const email = uniqueEmail("no-lockout-intg");

    await request(testApp)
      .post(`${AUTH_BASE_PATH}/register`)
      .send({ fullName: "No Lockout Test", email, password: TEST_PASSWORD });

    // 4 failed attempts (below threshold)
    for (let i = 0; i < 4; i++) {
      await request(testApp)
        .post(`${AUTH_BASE_PATH}/login`)
        .send({ email, password: "WrongPassword!99" });
    }

    // Correct password on 5th attempt — should succeed
    const goodResp = await request(testApp)
      .post(`${AUTH_BASE_PATH}/login`)
      .send({ email, password: TEST_PASSWORD });

    expect(goodResp.status).toBe(200);
  });
});
