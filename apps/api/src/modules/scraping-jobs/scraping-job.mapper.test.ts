import { describe, expect, it } from "vitest";

import { mapScrapingJobDetail } from "./scraping-job.mapper.js";
import type { ScrapingJobDetailRecord } from "./scraping-job.repository.js";

const pausedRecord: ScrapingJobDetailRecord = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "legacy",
  source: "fixture-business-directory",
  status: "PAUSED",
  searchQuery: "legacy",
  location: "Austin, TX",
  requestedLimit: 10,
  processedCount: 2,
  successCount: 1,
  failureCount: 0,
  duplicateCount: 1,
  progressPercentage: 20,
  createdAt: new Date("2026-07-23T12:00:00.000Z"),
  updatedAt: new Date("2026-07-23T12:01:00.000Z"),
  startedAt: new Date("2026-07-23T12:00:30.000Z"),
  completedAt: null,
  failedAt: null,
  cancelledAt: null,
  errorMessage: null,
  queueJobId: "queue-1",
  retryOfJobId: null,
  _count: { leads: 1 },
};

describe("mapScrapingJobDetail", () => {
  it("defensively maps legacy PAUSED without enabling unsupported actions", () => {
    expect(mapScrapingJobDetail(pausedRecord)).toMatchObject({
      status: "CANCELLED",
      canCancel: false,
      canRetry: false,
      leadCount: 1,
    });
  });

  it("caps malformed persisted progress at the public 0-100 range", () => {
    expect(
      mapScrapingJobDetail({ ...pausedRecord, progressPercentage: 120 })
        .progressPercentage,
    ).toBe(100);
    expect(
      mapScrapingJobDetail({ ...pausedRecord, progressPercentage: -1 })
        .progressPercentage,
    ).toBe(0);
  });

  it("preserves the approved development source without relabelling it", () => {
    expect(
      mapScrapingJobDetail({
        ...pausedRecord,
        source: "permitted-http-directory",
      }).source,
    ).toBe("permitted-http-directory");
  });
});
