import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { errorHandler } from "../../common/middleware/error.middleware.js";
import { disconnectDatabase, prisma } from "../../infrastructure/database/prisma.js";

vi.mock("../../infrastructure/redis/redis.health.js", () => ({
  checkRedisHealth: vi.fn().mockImplementation(async () => Promise.resolve()),
  disconnectRedisHealthClient: vi.fn().mockImplementation(async () => Promise.resolve()),
}));

vi.mock("../../infrastructure/queue/queue.health.js", () => ({
  checkQueueHealth: vi.fn().mockResolvedValue({
    status: "healthy",
    queues: {
      scraping: { active: 0, waiting: 0, failed: 0, completed: 0 },
      csvImport: { active: 0, waiting: 0, failed: 0, completed: 0 },
    },
  }),
}));

import { healthRouter } from "./health.routes.js";

const testApp = express();
testApp.use(express.json());
testApp.use("/api/v1/health", healthRouter);
testApp.use(errorHandler);

let dbAvailable = false;

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    dbAvailable = false;
  }
});

afterAll(async () => {
  await disconnectDatabase();
});

describe("Health Endpoints", () => {
  describe("GET /api/v1/health/liveness", () => {
    it("returns 200 with alive status immediately", async () => {
      const response = await request(testApp).get("/api/v1/health/liveness");
      expect(response.status).toBe(200);
      const body = response.body as {
        success: boolean;
        data: { status: string; timestamp: string };
      };
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("alive");
      expect(body.data.timestamp).toBeDefined();
    });

    it("includes a valid ISO timestamp", async () => {
      const response = await request(testApp).get("/api/v1/health/liveness");
      const body = response.body as { data: { timestamp: string } };
      const ts = new Date(body.data.timestamp);
      expect(ts.getTime()).not.toBeNaN();
    });
  });

  describe("GET /api/v1/health/readiness", () => {
    it("returns a JSON response with database and redis status", async () => {
      const response = await request(testApp).get("/api/v1/health/readiness");
      expect([200, 503]).toContain(response.status);
      const body = response.body as {
        data: { database: string; redis: string; status: string };
      };
      expect(["ready", "not_ready"]).toContain(body.data.database);
      expect(["ready", "not_ready"]).toContain(body.data.redis);
      expect(["ready", "not_ready"]).toContain(body.data.status);
    });

    it("returns 200 when database is available", async () => {
      if (!dbAvailable) return;
      const response = await request(testApp).get("/api/v1/health/readiness");
      expect(response.status).toBe(200);
      const body = response.body as { data: { database: string } };
      expect(body.data.database).toBe("ready");
    });
  });

  describe("GET /api/v1/health", () => {
    it("returns a JSON response with service name and timestamp", async () => {
      const response = await request(testApp).get("/api/v1/health");
      expect([200, 503]).toContain(response.status);
      const body = response.body as {
        data: { service: string; timestamp: string; database: string; redis: string };
      };
      expect(body.data.service).toBe("api");
      expect(["connected", "disconnected"]).toContain(body.data.database);
      expect(["connected", "disconnected"]).toContain(body.data.redis);
    });

    it("returns 200 with success=true when database is available", async () => {
      if (!dbAvailable) return;
      const response = await request(testApp).get("/api/v1/health");
      expect(response.status).toBe(200);
      const body = response.body as { success: boolean; data: { database: string } };
      expect(body.success).toBe(true);
      expect(body.data.database).toBe("connected");
    });

    it("includes queue information in the response", async () => {
      const response = await request(testApp).get("/api/v1/health");
      const body = response.body as { data: { queues: unknown } };
      expect(body.data.queues).toBeDefined();
    });
  });

  describe("GET /api/v1/health/metrics", () => {
    it("returns JSON metrics by default", async () => {
      const response = await request(testApp).get("/api/v1/health/metrics");
      expect(response.status).toBe(200);
      const body = response.body as {
        success: boolean;
        data: {
          service: string;
          uptimeSeconds: number;
          system: { platform: string; nodeVersion: string };
          process: { pid: number };
        };
      };
      expect(body.success).toBe(true);
      expect(body.data.service).toBe("@lead-saas/api");
      expect(typeof body.data.uptimeSeconds).toBe("number");
      expect(body.data.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(body.data.system.platform).toBeDefined();
      expect(body.data.system.nodeVersion).toMatch(/^v\d+/);
      expect(typeof body.data.process.pid).toBe("number");
    });

    it("returns prometheus text format when ?format=prometheus", async () => {
      const response = await request(testApp)
        .get("/api/v1/health/metrics")
        .query({ format: "prometheus" });
      expect(response.status).toBe(200);
      const ct = response.headers["content-type"] as string;
      expect(ct).toContain("text/plain");
      const text = response.text;
      expect(text).toContain("process_uptime_seconds");
      expect(text).toContain("process_heap_bytes");
      expect(text).toContain("dependency_up");
    });

    it("includes dependency statuses in prometheus metrics", async () => {
      const response = await request(testApp)
        .get("/api/v1/health/metrics")
        .query({ format: "prometheus" });
      expect(response.text).toContain('dependency_up{name="database"}');
      expect(response.text).toContain('dependency_up{name="redis"}');
    });
  });
});
