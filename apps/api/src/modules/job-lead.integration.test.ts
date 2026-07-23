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

vi.mock("../infrastructure/queue/scraping.queue.js", () => ({
  enqueueScrapingJob: vi.fn(
    async (data: { scrapingJobId: string }) => ({ id: data.scrapingJobId }),
  ),
  removeScrapingQueueJob: vi.fn(async () => true),
}));

import { errorHandler } from "../common/middleware/error.middleware.js";
import { env } from "../config/env.js";
import {
  disconnectDatabase,
  prisma,
} from "../infrastructure/database/prisma.js";
import {
  enqueueScrapingJob,
  removeScrapingQueueJob,
} from "../infrastructure/queue/scraping.queue.js";
import { createTokenPair } from "./auth/token.service.js";
import { dashboardRouter } from "./dashboard/dashboard.routes.js";
import { leadRouter } from "./leads/lead.routes.js";
import { scrapingJobRouter } from "./scraping-jobs/scraping-job.routes.js";

const TEST_EMAIL_PREFIX = "phase7-api-test-";

const testApp = express();
testApp.use(express.json());
testApp.use("/api/v1/scraping-jobs", scrapingJobRouter);
testApp.use("/api/v1/leads", leadRouter);
testApp.use("/api/v1/dashboard", dashboardRouter);
testApp.use(errorHandler);

let safeTestDatabase = false;

const cleanup = async (): Promise<void> => {
  const users = await prisma.user.findMany({
    where: { email: { startsWith: TEST_EMAIL_PREFIX } },
    select: { id: true },
  });
  const userIds = users.map((user) => user.id);
  if (userIds.length === 0) return;
  await prisma.lead.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.scrapingJob.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.userSession.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
};

const createAuthenticatedUser = async (label: string) => {
  const user = await prisma.user.create({
    data: {
      email: `${TEST_EMAIL_PREFIX}${label}-${randomUUID()}@example.test`,
      fullName: `Phase 7 ${label}`,
      passwordHash: "INTEGRATION_TEST_PASSWORD_HASH",
      role: "USER",
      status: "ACTIVE",
    },
  });
  const sessionId = randomUUID();
  await prisma.userSession.create({
    data: {
      id: sessionId,
      userId: user.id,
      refreshTokenHash: "a".repeat(64),
      expiresAt: new Date(Date.now() + 60 * 60 * 1_000),
    },
  });
  const tokens = await createTokenPair(user.id, user.role, sessionId);
  return {
    user,
    authorization: `Bearer ${tokens.accessToken}`,
  };
};

const createJob = async (
  userId: string,
  overrides: {
    status?: "PENDING" | "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
    searchQuery?: string;
    location?: string;
    source?: string;
    successCount?: number;
    createdAt?: Date;
  } = {},
) =>
  prisma.scrapingJob.create({
    data: {
      name: overrides.searchQuery ?? "plumbers",
      source: overrides.source ?? "fixture-business-directory",
      location: overrides.location ?? "Austin, TX",
      country: "United States",
      searchQuery: overrides.searchQuery ?? "plumbers",
      requestedLimit: 25,
      status: overrides.status ?? "COMPLETED",
      successCount: overrides.successCount ?? 0,
      userId,
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
      ...(overrides.status === "FAILED"
        ? { failedAt: new Date(), errorMessage: "Safe test failure" }
        : {}),
    },
  });

const createLead = async (
  userId: string,
  scrapingJobId: string,
  overrides: {
    businessName?: string;
    phoneRaw?: string | null;
    email?: string | null;
    city?: string;
  } = {},
) =>
  prisma.lead.create({
    data: {
      userId,
      scrapingJobId,
      businessName: overrides.businessName ?? "Example Plumbing",
      phoneRaw:
        overrides.phoneRaw === undefined ? "+12025550101" : overrides.phoneRaw,
      phoneNormalized:
        overrides.phoneRaw === null ? null : "+12025550101",
      email:
        overrides.email === undefined ? "hello@example.test" : overrides.email,
      website: "https://example.test/",
      domain: "example.test",
      addressLine1: "123 Main Street",
      city: overrides.city ?? "Austin",
      state: "TX",
      postalCode: "78701",
      country: "United States",
      category: "Plumbing",
      sourceType: "BUSINESS_DIRECTORY",
      sourceName: "Local Fixture",
      sourceUrl: "fixture://business/1",
    },
  });

beforeAll(async () => {
  if (env.NODE_ENV !== "test") {
    throw new Error("Refusing to run Phase 7 integration tests unless NODE_ENV is test");
  }
  const databaseName = decodeURIComponent(
    new URL(env.DATABASE_URL).pathname.replace(/^\/+/, ""),
  );
  if (!databaseName.endsWith("_auth_test")) {
    throw new Error("Refusing to run Phase 7 integration tests outside the test database");
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

describe("Phase 7 protected job APIs", () => {
  it("requires authentication", async () => {
    const response = await request(testApp).get("/api/v1/scraping-jobs");
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
  });

  it("creates an owned job and maps the public source to the fixture adapter", async () => {
    const actor = await createAuthenticatedUser("create");
    const response = await request(testApp)
      .post("/api/v1/scraping-jobs")
      .set("Authorization", actor.authorization)
      .send({
        source: "fixture-business-directory",
        searchQuery: "plumbers",
        location: "Austin, TX",
        requestedLimit: 25,
      });

    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        job: {
          source: "fixture-business-directory",
          status: "QUEUED",
          searchQuery: "plumbers",
        },
      },
    });
    const persisted = await prisma.scrapingJob.findFirstOrThrow({
      where: { userId: actor.user.id },
    });
    expect(persisted.userId).toBe(actor.user.id);
    expect(persisted.queueJobId).toBe(persisted.id);
    expect(enqueueScrapingJob).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceKey: "fixture-directory",
        requestedById: actor.user.id,
      }),
    );
  });

  it("rejects arbitrary sources before queueing", async () => {
    const actor = await createAuthenticatedUser("source");
    const response = await request(testApp)
      .post("/api/v1/scraping-jobs")
      .set("Authorization", actor.authorization)
      .send({
        source: "https://unapproved.example",
        searchQuery: "plumbers",
        location: "Austin, TX",
        requestedLimit: 25,
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      error: { code: "APPROVED_SOURCE_REQUIRED" },
    });
    expect(enqueueScrapingJob).not.toHaveBeenCalled();
  });

  it("lists and reads only the authenticated user's jobs", async () => {
    const owner = await createAuthenticatedUser("owner");
    const other = await createAuthenticatedUser("other");
    const owned = await createJob(owner.user.id, {
      searchQuery: "roofers",
      location: "Denver, CO",
    });
    const hidden = await createJob(other.user.id, {
      searchQuery: "roofers",
      location: "Denver, CO",
    });

    const listResponse = await request(testApp)
      .get("/api/v1/scraping-jobs?search=roof&page=1&pageSize=1")
      .set("Authorization", owner.authorization);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.jobs).toHaveLength(1);
    expect(listResponse.body.data.jobs[0].id).toBe(owned.id);
    expect(listResponse.body.data.pagination.totalItems).toBe(1);

    const detailResponse = await request(testApp)
      .get(`/api/v1/scraping-jobs/${hidden.id}`)
      .set("Authorization", owner.authorization);
    expect(detailResponse.status).toBe(404);
    expect(detailResponse.body.error.code).toBe("SCRAPING_JOB_NOT_FOUND");
  });

  it("combines status, approved-source, and date filters before sorting multiple rows", async () => {
    const actor = await createAuthenticatedUser("job-filters");
    const matchingLow = await createJob(actor.user.id, {
      status: "COMPLETED",
      searchQuery: "matching-low",
      successCount: 3,
      createdAt: new Date("2026-07-10T10:00:00.000Z"),
    });
    const matchingHigh = await createJob(actor.user.id, {
      status: "COMPLETED",
      searchQuery: "matching-high",
      successCount: 9,
      createdAt: new Date("2026-07-20T10:00:00.000Z"),
    });
    await createJob(actor.user.id, {
      status: "RUNNING",
      searchQuery: "wrong-status",
      successCount: 1,
      createdAt: new Date("2026-07-15T10:00:00.000Z"),
    });
    await createJob(actor.user.id, {
      status: "COMPLETED",
      searchQuery: "wrong-source",
      source: "permitted-http-directory",
      successCount: 2,
      createdAt: new Date("2026-07-15T10:00:00.000Z"),
    });
    await createJob(actor.user.id, {
      status: "COMPLETED",
      searchQuery: "outside-date-window",
      successCount: 4,
      createdAt: new Date("2026-06-30T23:59:59.999Z"),
    });

    const response = await request(testApp)
      .get(
        "/api/v1/scraping-jobs?status=COMPLETED" +
          "&source=fixture-business-directory" +
          "&createdFrom=2026-07-01&createdTo=2026-07-31" +
          "&sortBy=successCount&sortOrder=asc&page=1&pageSize=20",
      )
      .set("Authorization", actor.authorization);

    expect(response.status).toBe(200);
    expect(response.body.data.jobs.map((job: { id: string }) => job.id)).toEqual([
      matchingLow.id,
      matchingHigh.id,
    ]);
    expect(response.body.data.pagination).toMatchObject({
      page: 1,
      pageSize: 20,
      totalItems: 2,
      totalPages: 1,
    });
  });

  it("cancels an owned active job database-first and rejects a terminal job", async () => {
    const actor = await createAuthenticatedUser("cancel");
    const queued = await prisma.scrapingJob.create({
      data: {
        name: "queued",
        source: "fixture-business-directory",
        location: "Austin, TX",
        searchQuery: "queued",
        requestedLimit: 10,
        status: "QUEUED",
        queueJobId: "queue-cancel",
        userId: actor.user.id,
      },
    });
    const completed = await createJob(actor.user.id, { status: "COMPLETED" });

    const cancelledResponse = await request(testApp)
      .post(`/api/v1/scraping-jobs/${queued.id}/cancel`)
      .set("Authorization", actor.authorization);
    expect(cancelledResponse.status).toBe(200);
    expect(cancelledResponse.body.data.job.status).toBe("CANCELLED");
    expect(removeScrapingQueueJob).toHaveBeenCalledWith("queue-cancel");
    expect(
      (await prisma.scrapingJob.findUniqueOrThrow({ where: { id: queued.id } })).status,
    ).toBe("CANCELLED");

    const terminalResponse = await request(testApp)
      .post(`/api/v1/scraping-jobs/${completed.id}/cancel`)
      .set("Authorization", actor.authorization);
    expect(terminalResponse.status).toBe(409);
    expect(terminalResponse.body.error.code).toBe(
      "SCRAPING_JOB_NOT_CANCELLABLE",
    );
  });

  it("retries a failed job as a new linked record", async () => {
    const actor = await createAuthenticatedUser("retry");
    const failed = await createJob(actor.user.id, { status: "FAILED" });

    const response = await request(testApp)
      .post(`/api/v1/scraping-jobs/${failed.id}/retry`)
      .set("Authorization", actor.authorization);
    expect(response.status).toBe(202);
    expect(response.body.data.job.id).not.toBe(failed.id);
    const retry = await prisma.scrapingJob.findFirstOrThrow({
      where: { retryOfJobId: failed.id, userId: actor.user.id },
    });
    expect(retry.status).toBe("QUEUED");
  });
});

describe("Phase 7 protected lead and dashboard APIs", () => {
  it("filters, paginates, and reads leads only within the tenant", async () => {
    const owner = await createAuthenticatedUser("lead-owner");
    const other = await createAuthenticatedUser("lead-other");
    const ownerJob = await createJob(owner.user.id);
    const otherJob = await createJob(other.user.id);
    const firstOwned = await createLead(owner.user.id, ownerJob.id, {
      businessName: "Austin Alpha Plumbing",
    });
    const secondOwned = await createLead(owner.user.id, ownerJob.id, {
      businessName: "Austin Zulu Plumbing",
    });
    const hidden = await createLead(other.user.id, otherJob.id, {
      businessName: "Austin Plumbing",
    });

    const listResponse = await request(testApp)
      .get(
        "/api/v1/leads?search=Plumbing&city=Austin&hasPhone=true" +
          "&sortBy=businessName&sortOrder=asc&page=1&pageSize=1",
      )
      .set("Authorization", owner.authorization);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data.leads).toHaveLength(1);
    expect(listResponse.body.data.leads[0].id).toBe(firstOwned.id);
    expect(listResponse.body.data.pagination).toMatchObject({
      page: 1,
      pageSize: 1,
      totalItems: 2,
      totalPages: 2,
    });

    const secondPageResponse = await request(testApp)
      .get(
        "/api/v1/leads?search=Plumbing&city=Austin&hasPhone=true" +
          "&sortBy=businessName&sortOrder=asc&page=2&pageSize=1",
      )
      .set("Authorization", owner.authorization);
    expect(secondPageResponse.status).toBe(200);
    expect(secondPageResponse.body.data.leads).toHaveLength(1);
    expect(secondPageResponse.body.data.leads[0].id).toBe(secondOwned.id);

    const detailResponse = await request(testApp)
      .get(`/api/v1/leads/${hidden.id}`)
      .set("Authorization", owner.authorization);
    expect(detailResponse.status).toBe(404);
    expect(detailResponse.body.error.code).toBe("LEAD_NOT_FOUND");
  });

  it("exports only owned rows and neutralizes spreadsheet formulas", async () => {
    const owner = await createAuthenticatedUser("export-owner");
    const other = await createAuthenticatedUser("export-other");
    const ownerJob = await createJob(owner.user.id);
    const otherJob = await createJob(other.user.id);
    await createLead(owner.user.id, ownerJob.id, {
      businessName: "=1+1",
      phoneRaw: "+12025550101",
    });
    await createLead(other.user.id, otherJob.id, {
      businessName: "Hidden Tenant Lead",
    });

    const response = await request(testApp)
      .get("/api/v1/leads/export.csv")
      .set("Authorization", owner.authorization);

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/csv");
    expect(response.headers["content-disposition"]).toContain("attachment;");
    expect(response.text.startsWith("\uFEFF")).toBe(true);
    expect(response.text).toContain('"\'=1+1"');
    expect(response.text).not.toContain("Hidden Tenant Lead");
  });

  it("returns a tenant-owned dashboard summary", async () => {
    const owner = await createAuthenticatedUser("summary-owner");
    const other = await createAuthenticatedUser("summary-other");
    const completed = await createJob(owner.user.id, { status: "COMPLETED" });
    await createJob(owner.user.id, { status: "RUNNING" });
    await createJob(other.user.id, { status: "FAILED" });
    await createLead(owner.user.id, completed.id, { email: null });

    const response = await request(testApp)
      .get("/api/v1/dashboard/summary")
      .set("Authorization", owner.authorization);

    expect(response.status).toBe(200);
    expect(response.body.data.summary).toEqual({
      totalJobs: 2,
      activeJobs: 1,
      completedJobs: 1,
      failedJobs: 0,
      totalLeads: 1,
      leadsWithPhone: 1,
      leadsWithEmail: 0,
    });
  });
});
