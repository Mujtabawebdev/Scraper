import { randomUUID } from "node:crypto";

import express from "express";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

vi.mock("../../infrastructure/queue/scraping.queue.js", () => ({
  removeScrapingQueueJob: vi.fn(async () => true),
}));

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
import { createTokenPair } from "../auth/token.service.js";
import { adminRouter } from "./admin.routes.js";
import {
  assertAutomatedAccessAllowed,
  markSourceBlocked,
} from "./source-policy.service.js";

const PREFIX = "phase8-admin-test-";
const app = express();
app.use(express.json());
app.use("/api/v1/admin", adminRouter);
app.use(errorHandler);

let safeTestDatabase = false;

const createUser = async (
  label: string,
  role: UserRole = "USER",
  status: UserStatus = "ACTIVE",
) => {
  const user = await prisma.user.create({
    data: {
      email: `${PREFIX}${label}-${randomUUID()}@example.test`,
      fullName: `Phase 8 ${label}`,
      passwordHash: "NON_LOGIN_INTEGRATION_TEST_HASH",
      role,
      status,
    },
  });
  const session = await prisma.userSession.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      refreshTokenHash: randomUUID().replaceAll("-", "").padEnd(64, "a"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
    },
  });
  const token = await createTokenPair(user.id, role, session.id);
  return {
    user,
    session,
    authorization: `Bearer ${token.accessToken}`,
  };
};

const cleanup = async () => {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: PREFIX } },
    select: { id: true },
  });
  const ids = users.map((user) => user.id);
  if (ids.length === 0) return;
  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { actorId: { in: ids } },
        { targetUserId: { in: ids } },
      ],
    },
  });
  await prisma.approvedSource.deleteMany({
    where: {
      OR: [
        { createdByUserId: { in: ids } },
        { updatedByUserId: { in: ids } },
      ],
    },
  });
  await prisma.lead.deleteMany({ where: { userId: { in: ids } } });
  await prisma.scrapingJob.deleteMany({ where: { userId: { in: ids } } });
  await prisma.userSession.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
};

beforeAll(() => {
  if (env.NODE_ENV !== "test") {
    throw new Error("Refusing to run Phase 8 integration tests outside test mode");
  }
  const databaseName = decodeURIComponent(
    new URL(env.DATABASE_URL).pathname.replace(/^\/+/, ""),
  );
  if (!databaseName.endsWith("_auth_test")) {
    throw new Error("Refusing to run Phase 8 tests outside the test database");
  }
  safeTestDatabase = true;
});

beforeEach(async () => {
  vi.clearAllMocks();
  if (safeTestDatabase) await cleanup();
});

afterAll(async () => {
  if (safeTestDatabase) await cleanup();
  await disconnectDatabase();
});

describe("Phase 8 administrator APIs", () => {
  it("denies normal users and allows both admin roles", async () => {
    const normal = await createUser("normal");
    const admin = await createUser("admin", "ADMIN");
    const superAdmin = await createUser("super", "SUPER_ADMIN");

    const denied = await request(app)
      .get("/api/v1/admin/summary")
      .set("Authorization", normal.authorization);
    const adminResponse = await request(app)
      .get("/api/v1/admin/summary")
      .set("Authorization", admin.authorization);
    const superResponse = await request(app)
      .get("/api/v1/admin/summary")
      .set("Authorization", superAdmin.authorization);

    expect(denied.status).toBe(403);
    expect(adminResponse.status).toBe(200);
    expect(superResponse.status).toBe(200);
    expect(adminResponse.body.data.summary).toEqual(
      expect.objectContaining({
        totalUsers: expect.any(Number),
        totalJobs: expect.any(Number),
        totalLeads: expect.any(Number),
      }),
    );
  });

  it("paginates, filters, searches, and safelists user responses", async () => {
    const admin = await createUser("admin", "ADMIN");
    const target = await createUser("searchable-user");
    await createUser("disabled-user", "USER", "DISABLED");

    const response = await request(app)
      .get("/api/v1/admin/users")
      .query({
        page: 1,
        pageSize: 1,
        search: target.user.email,
        role: "USER",
        status: "ACTIVE",
      })
      .set("Authorization", admin.authorization);

    expect(response.status).toBe(200);
    expect(response.body.data.users).toHaveLength(1);
    expect(response.body.data.pagination).toEqual(
      expect.objectContaining({ page: 1, pageSize: 1, totalItems: 1 }),
    );
    expect(JSON.stringify(response.body)).not.toMatch(
      /passwordHash|refreshTokenHash|accessToken/i,
    );
  });

  it("returns safe user detail statistics", async () => {
    const admin = await createUser("admin", "ADMIN");
    const target = await createUser("detail");
    const response = await request(app)
      .get(`/api/v1/admin/users/${target.user.id}`)
      .set("Authorization", admin.authorization);

    expect(response.status).toBe(200);
    expect(response.body.data.user).toEqual(
      expect.objectContaining({
        id: target.user.id,
        activeSessionCount: 1,
        totalJobs: 0,
        totalLeads: 0,
      }),
    );
  });

  it("suspends a normal user, revokes sessions, cancels jobs, then reactivates", async () => {
    const admin = await createUser("admin", "ADMIN");
    const target = await createUser("managed");
    const job = await prisma.scrapingJob.create({
      data: {
        name: "phase 8 active job",
        source: "fixture-business-directory",
        location: "Austin, TX",
        country: "United States",
        searchQuery: "plumbers",
        requestedLimit: 10,
        status: "QUEUED",
        queueJobId: randomUUID(),
        userId: target.user.id,
      },
    });

    const suspended = await request(app)
      .patch(`/api/v1/admin/users/${target.user.id}/status`)
      .set("Authorization", admin.authorization)
      .send({ status: "SUSPENDED", reason: "Repeated scraping limit abuse" });
    expect(suspended.status).toBe(200);
    expect(suspended.body.data.user.status).toBe("SUSPENDED");
    expect(
      await prisma.userSession.count({
        where: { userId: target.user.id, revokedAt: null },
      }),
    ).toBe(0);
    expect(
      await prisma.scrapingJob.findUnique({ where: { id: job.id } }),
    ).toMatchObject({ status: "CANCELLED" });

    const reactivated = await request(app)
      .patch(`/api/v1/admin/users/${target.user.id}/status`)
      .set("Authorization", admin.authorization)
      .send({ status: "ACTIVE", reason: "Compliance review completed" });
    expect(reactivated.status).toBe(200);
    expect(reactivated.body.data.user.status).toBe("ACTIVE");
  });

  it("prevents self-suspension and ADMIN changes to SUPER_ADMIN", async () => {
    const admin = await createUser("admin", "ADMIN");
    const superAdmin = await createUser("super", "SUPER_ADMIN");

    const self = await request(app)
      .patch(`/api/v1/admin/users/${admin.user.id}/status`)
      .set("Authorization", admin.authorization)
      .send({ status: "SUSPENDED", reason: "Invalid self operation" });
    const protectedSuper = await request(app)
      .patch(`/api/v1/admin/users/${superAdmin.user.id}/status`)
      .set("Authorization", admin.authorization)
      .send({ status: "SUSPENDED", reason: "Invalid privilege operation" });

    expect(self.status).toBe(409);
    expect(self.body.error.code).toBe("INVALID_USER_STATUS_TRANSITION");
    expect(protectedSuper.status).toBe(403);
    expect(protectedSuper.body.error.code).toBe("CANNOT_MODIFY_SUPER_ADMIN");
  });

  it("requires SUPER_ADMIN for role changes and prevents self-role changes", async () => {
    const admin = await createUser("admin", "ADMIN");
    const superAdmin = await createUser("super", "SUPER_ADMIN");
    const target = await createUser("target");

    const denied = await request(app)
      .patch(`/api/v1/admin/users/${target.user.id}/role`)
      .set("Authorization", admin.authorization)
      .send({ role: "ADMIN", reason: "Operations responsibility assigned" });
    const changed = await request(app)
      .patch(`/api/v1/admin/users/${target.user.id}/role`)
      .set("Authorization", superAdmin.authorization)
      .send({ role: "ADMIN", reason: "Operations responsibility assigned" });
    const self = await request(app)
      .patch(`/api/v1/admin/users/${superAdmin.user.id}/role`)
      .set("Authorization", superAdmin.authorization)
      .send({ role: "ADMIN", reason: "Invalid self role operation" });

    expect(denied.status).toBe(403);
    expect(changed.status).toBe(200);
    expect(changed.body.data.user.role).toBe("ADMIN");
    expect(self.status).toBe(409);
    expect(self.body.error.code).toBe("CANNOT_MODIFY_OWN_ROLE");
  });

  it("lists job detail and cooperatively cancels active jobs", async () => {
    const admin = await createUser("admin", "ADMIN");
    const owner = await createUser("owner");
    const job = await prisma.scrapingJob.create({
      data: {
        name: "monitored job",
        source: "fixture-business-directory",
        location: "Dallas, TX",
        country: "United States",
        searchQuery: "roofers",
        requestedLimit: 25,
        status: "RUNNING",
        userId: owner.user.id,
      },
    });
    const list = await request(app)
      .get("/api/v1/admin/scraping-jobs")
      .query({ userEmail: owner.user.email })
      .set("Authorization", admin.authorization);
    const detail = await request(app)
      .get(`/api/v1/admin/scraping-jobs/${job.id}`)
      .set("Authorization", admin.authorization);
    const cancelled = await request(app)
      .post(`/api/v1/admin/scraping-jobs/${job.id}/cancel`)
      .set("Authorization", admin.authorization)
      .send({ reason: "Source pending compliance review" });

    expect(list.status).toBe(200);
    expect(list.body.data.jobs[0].owner.email).toBe(owner.user.email);
    expect(detail.body.data.job.canCancel).toBe(true);
    expect(cancelled.body.data.job.status).toBe("CANCELLED");
  });

  it("redacts sensitive audit metadata", async () => {
    const admin = await createUser("admin", "ADMIN");
    await prisma.auditLog.create({
      data: {
        actorId: admin.user.id,
        action: "PHASE8_SAFETY_TEST",
        entityType: "TEST",
        metadata: {
          summary: "Safe summary",
          accessToken: "must-not-leak",
          nested: { password: "must-not-leak", safe: "visible" },
        },
      },
    });
    const response = await request(app)
      .get("/api/v1/admin/audit-logs")
      .query({ action: "PHASE8_SAFETY_TEST" })
      .set("Authorization", admin.authorization);
    expect(response.status).toBe(200);
    expect(response.body.data.auditLogs[0].metadata).toMatchObject({
      accessToken: "[REDACTED]",
      nested: { password: "[REDACTED]", safe: "visible" },
    });
    expect(JSON.stringify(response.body)).not.toContain("must-not-leak");
  });

  it("creates sources disabled and review-required and validates approval", async () => {
    const superAdmin = await createUser("super", "SUPER_ADMIN");
    const created = await request(app)
      .post("/api/v1/admin/sources")
      .set("Authorization", superAdmin.authorization)
      .send({
        key: `${PREFIX}directory`,
        displayName: "Phase 8 Reviewed Directory",
        sourceType: "PUBLIC_DIRECTORY",
        baseUrl: "https://directory.example.test",
        requiresApiKey: false,
        requestsPerMinute: 5,
        maxConcurrency: 1,
      });
    expect(created.status).toBe(201);
    expect(created.body.data.source).toEqual(
      expect.objectContaining({
        status: "REVIEW_REQUIRED",
        isEnabled: false,
        allowsAutomatedAccess: false,
      }),
    );

    const invalidApproval = await request(app)
      .patch(`/api/v1/admin/sources/${created.body.data.source.id}`)
      .set("Authorization", superAdmin.authorization)
      .send({
        status: "APPROVED",
        isEnabled: true,
        allowsAutomatedAccess: true,
      });
    expect(invalidApproval.status).toBe(409);
    expect(invalidApproval.body.error.code).toBe(
      "SOURCE_POLICY_REQUIREMENTS_NOT_MET",
    );
  });

  it("blocks source execution and exposes blocked counts", async () => {
    const superAdmin = await createUser("super", "SUPER_ADMIN");
    const key = `${PREFIX}blocked`;
    const source = await prisma.approvedSource.create({
      data: {
        key,
        displayName: "Phase 8 Blocked Source",
        sourceType: "PUBLIC_DIRECTORY",
        baseUrl: "https://blocked.example.test",
        status: "APPROVED",
        isEnabled: true,
        allowsAutomatedAccess: true,
        requestsPerMinute: 5,
        maxConcurrency: 1,
        robotsPolicyCheckedAt: new Date(),
        termsReviewedAt: new Date(),
        createdByUserId: superAdmin.user.id,
        updatedByUserId: superAdmin.user.id,
      },
    });
    await expect(assertAutomatedAccessAllowed(key)).resolves.toMatchObject({
      key,
    });
    await markSourceBlocked(key, "Automated access expressly prohibited");
    await expect(assertAutomatedAccessAllowed(key)).rejects.toMatchObject({
      code: "SOURCE_BLOCKED",
    });
    const summary = await request(app)
      .get("/api/v1/admin/summary")
      .set("Authorization", superAdmin.authorization);
    expect(summary.body.data.summary.blockedSources).toBeGreaterThanOrEqual(1);
    const stored = await prisma.approvedSource.findUnique({
      where: { id: source.id },
    });
    expect(stored).toMatchObject({
      status: "BLOCKED",
      isEnabled: false,
      allowsAutomatedAccess: false,
    });
  });
});
