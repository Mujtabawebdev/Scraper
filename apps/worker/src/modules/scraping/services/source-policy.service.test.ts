import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("../../../infrastructure/database/prisma.js", () => ({
  prisma: {
    approvedSource: {
      findUnique: mocks.findUnique,
      updateMany: mocks.updateMany,
    },
  },
}));
vi.mock("../../../config/env.js", () => ({
  env: {
    NODE_ENV: "test",
    SCRAPING_FIXTURE_SOURCE_ENABLED: false,
    SCRAPING_APPROVED_BASE_URL: "https://directory.example.test",
  },
}));

import {
  assertAutomatedAccessAllowed,
  markSourceBlocked,
  markSourceReviewRequired,
} from "./source-policy.service.js";

const approvedSource = {
  key: "permitted-http-directory",
  sourceType: "PUBLIC_DIRECTORY",
  baseUrl: "https://directory.example.test",
  status: "APPROVED",
  isEnabled: true,
  allowsAutomatedAccess: true,
  requestsPerMinute: 5,
  maxConcurrency: 1,
};

describe("worker source policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue(approvedSource);
    mocks.updateMany.mockResolvedValue({ count: 1 });
  });

  it("returns only enabled, approved automation policy", async () => {
    await expect(
      assertAutomatedAccessAllowed("permitted-http-directory"),
    ).resolves.toEqual({
      sourceKey: "permitted-http-directory",
      baseUrl: "https://directory.example.test",
      requestsPerMinute: 5,
      maxConcurrency: 1,
    });
  });

  it("rejects blocked and review-required sources", async () => {
    mocks.findUnique.mockResolvedValueOnce({
      ...approvedSource,
      status: "BLOCKED",
      isEnabled: false,
    });
    await expect(
      assertAutomatedAccessAllowed("permitted-http-directory"),
    ).rejects.toMatchObject({ code: "SOURCE_BLOCKED" });

    mocks.findUnique.mockResolvedValueOnce({
      ...approvedSource,
      status: "REVIEW_REQUIRED",
      isEnabled: false,
    });
    await expect(
      assertAutomatedAccessAllowed("permitted-http-directory"),
    ).rejects.toMatchObject({ code: "SOURCE_REVIEW_REQUIRED" });
  });

  it("atomically disables sources when blocked or review is required", async () => {
    await markSourceBlocked(
      "permitted-http-directory",
      "Automated access prohibited",
    );
    await markSourceReviewRequired(
      "permitted-http-directory",
      "Consent wall detected",
    );
    expect(mocks.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          status: "BLOCKED",
          isEnabled: false,
          allowsAutomatedAccess: false,
        }),
      }),
    );
    expect(mocks.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REVIEW_REQUIRED",
          isEnabled: false,
          allowsAutomatedAccess: false,
        }),
      }),
    );
  });
});
