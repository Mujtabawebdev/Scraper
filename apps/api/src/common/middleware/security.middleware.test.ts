import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { requestContextMiddleware } from "../../common/middleware/request-context.middleware.js";
import { securityHeadersMiddleware } from "../../common/middleware/security-headers.middleware.js";
import { errorHandler } from "../../common/middleware/error.middleware.js";
import helmet from "helmet";

const testApp = express();
testApp.disable("x-powered-by");
testApp.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    frameguard: { action: "deny" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    noSniff: true,
  }),
);
testApp.use(securityHeadersMiddleware);
testApp.use(requestContextMiddleware);
testApp.use(cookieParser());
testApp.use(express.json({ limit: "1mb" }));

testApp.get("/test-echo", (req, res) => {
  res.status(200).json({
    requestId: req.id,
    correlationId: req.correlationId,
    success: true,
  });
});

testApp.post("/test-json", (req, res) => {
  res.status(200).json({ body: req.body });
});

testApp.use(errorHandler);

describe("Security Middleware Integration", () => {
  describe("HTTP Security Headers (Helmet)", () => {
    it("sets X-Frame-Options to DENY", async () => {
      const response = await request(testApp).get("/test-echo");
      expect(response.headers["x-frame-options"]).toBe("DENY");
    });

    it("sets X-Content-Type-Options to nosniff", async () => {
      const response = await request(testApp).get("/test-echo");
      expect(response.headers["x-content-type-options"]).toBe("nosniff");
    });

    it("sets Strict-Transport-Security header", async () => {
      const response = await request(testApp).get("/test-echo");
      const hsts = response.headers["strict-transport-security"] as string;
      expect(hsts).toBeDefined();
      expect(hsts).toContain("max-age=31536000");
      expect(hsts).toContain("includeSubDomains");
    });

    it("sets Referrer-Policy header", async () => {
      const response = await request(testApp).get("/test-echo");
      expect(response.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    });

    it("sets Content-Security-Policy header with default-src 'self'", async () => {
      const response = await request(testApp).get("/test-echo");
      const csp = response.headers["content-security-policy"] as string;
      expect(csp).toBeDefined();
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
    });

    it("does not expose X-Powered-By header", async () => {
      const response = await request(testApp).get("/test-echo");
      expect(response.headers["x-powered-by"]).toBeUndefined();
    });
  });

  describe("Additional Security Headers Middleware", () => {
    it("sets Permissions-Policy header", async () => {
      const response = await request(testApp).get("/test-echo");
      const permissionsPolicy = response.headers["permissions-policy"] as string;
      expect(permissionsPolicy).toBeDefined();
      expect(permissionsPolicy).toContain("camera=()");
      expect(permissionsPolicy).toContain("microphone=()");
      expect(permissionsPolicy).toContain("geolocation=()");
    });

    it("sets Cross-Origin-Opener-Policy header", async () => {
      const response = await request(testApp).get("/test-echo");
      expect(response.headers["cross-origin-opener-policy"]).toBe("same-origin");
    });

    it("sets Cross-Origin-Resource-Policy header", async () => {
      const response = await request(testApp).get("/test-echo");
      expect(response.headers["cross-origin-resource-policy"]).toBe("same-origin");
    });
  });

  describe("Request Context Middleware", () => {
    it("generates a request id and sets X-Request-ID response header", async () => {
      const response = await request(testApp).get("/test-echo");
      const responseRequestId = response.headers["x-request-id"] as string;
      expect(responseRequestId).toBeDefined();
      expect(responseRequestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
      const body = response.body as { requestId: string; correlationId: string };
      expect(body.requestId).toBe(responseRequestId);
    });

    it("uses an incoming X-Request-ID if present", async () => {
      const incomingId = "my-custom-request-id";
      const response = await request(testApp).get("/test-echo").set("X-Request-ID", incomingId);
      expect(response.headers["x-request-id"]).toBe(incomingId);
      const body = response.body as { requestId: string };
      expect(body.requestId).toBe(incomingId);
    });

    it("uses X-Correlation-ID as correlationId if provided", async () => {
      const correlationId = "trace-abc-123";
      const response = await request(testApp)
        .get("/test-echo")
        .set("X-Correlation-ID", correlationId);
      expect(response.headers["x-correlation-id"]).toBe(correlationId);
      const body = response.body as { correlationId: string };
      expect(body.correlationId).toBe(correlationId);
    });

    it("defaults correlationId to requestId when X-Correlation-ID is not provided", async () => {
      const response = await request(testApp).get("/test-echo");
      const body = response.body as { requestId: string; correlationId: string };
      expect(body.correlationId).toBe(body.requestId);
    });
  });

  describe("Malformed JSON handling", () => {
    it("returns 400 for malformed JSON body", async () => {
      const response = await request(testApp)
        .post("/test-json")
        .set("Content-Type", "application/json")
        .send("{invalid json}");
      expect(response.status).toBe(400);
      const body = response.body as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("accepts valid JSON body", async () => {
      const response = await request(testApp)
        .post("/test-json")
        .send({ hello: "world" });
      expect(response.status).toBe(200);
    });
  });
});
