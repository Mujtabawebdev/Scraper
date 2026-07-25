import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../common/logger/logger.js", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("../../config/env.js", () => ({
  env: {
    SCRAPING_EXTERNAL_SOURCE_ENABLED: true,
    SCRAPING_APPROVED_BASE_URL: "https://approved.example",
    GOOGLE_PLACES_API_KEY: "google-key",
    GOVERNMENT_DATASET_URL: "https://government.example",
    META_APPROVED_API_ACCESS_TOKEN: "meta-token",
    YELP_APPROVED_API_KEY: "yelp-key",
  },
}));

vi.mock("../../infrastructure/queue/scraping.queue.js", () => ({
  enqueueScrapingJob: vi.fn(),
  removeScrapingQueueJob: vi.fn(),
}));

vi.mock("../admin/source-policy.service.js", () => ({
  assertAutomatedAccessAllowed: vi.fn(async () => ({
    key: "fixture-business-directory",
  })),
}));

vi.mock("../billing/entitlement.service.js", () => ({
  assertCanConsume: vi.fn().mockResolvedValue({}),
}));

vi.mock("../billing/usage.service.js", () => ({
  reserveUsage: vi.fn().mockResolvedValue({}),
  consumeReservation: vi.fn().mockResolvedValue({}),
  releaseReservation: vi.fn().mockResolvedValue({}),
}));

vi.mock("./scraping-job.repository.js", () => ({
  cancelOwnedScrapingJob: vi.fn(),
  countRecentOwnedJobsBySource: vi.fn(),
  createScrapingJobRecord: vi.fn(),
  findOwnedScrapingJobDetail: vi.fn(),
  findOwnedScrapingJobForRetry: vi.fn(),
  findOwnedScrapingJobSummary: vi.fn(),
  listOwnedScrapingJobs: vi.fn(),
  markScrapingJobEnqueueFailed: vi.fn(),
  markScrapingJobQueued: vi.fn(),
}));

import {
  enqueueScrapingJob,
  removeScrapingQueueJob,
} from "../../infrastructure/queue/scraping.queue.js";
import {
  cancelOwnedScrapingJob,
  countRecentOwnedJobsBySource,
  createScrapingJobRecord,
  findOwnedScrapingJobDetail,
  findOwnedScrapingJobForRetry,
  findOwnedScrapingJobSummary,
  markScrapingJobEnqueueFailed,
  markScrapingJobQueued,
  type ScrapingJobDetailRecord,
  type ScrapingJobRetrySourceRecord,
  type ScrapingJobSummaryRecord,
} from "./scraping-job.repository.js";
import { sourceNotPermittedError } from "./scraping-job.errors.js";
import {
  cancelScrapingJob,
  createScrapingJob,
  getScrapingJob,
  retryScrapingJob,
} from "./scraping-job.service.js";
import { assertAutomatedAccessAllowed } from "../admin/source-policy.service.js";

const createdAt = new Date("2026-07-23T12:00:00.000Z");

const pendingRecord: ScrapingJobSummaryRecord = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "plumbers",
  source: "fixture-business-directory",
  status: "PENDING",
  searchQuery: "plumbers",
  location: "Austin, TX",
  requestedLimit: 20,
  processedCount: 0,
  successCount: 0,
  failureCount: 0,
  duplicateCount: 0,
  progressPercentage: 0,
  createdAt,
  startedAt: null,
  completedAt: null,
  failedAt: null,
  cancelledAt: null,
};

const detailRecord: ScrapingJobDetailRecord = {
  ...pendingRecord,
  status: "QUEUED",
  updatedAt: createdAt,
  errorMessage: null,
  queueJobId: "queue-1",
  retryOfJobId: null,
  _count: { leads: 0 },
};

const retryRecord: ScrapingJobRetrySourceRecord = {
  id: pendingRecord.id,
  userId: "user-1",
  source: "fixture-business-directory",
  status: "FAILED",
  searchQuery: "plumbers",
  location: "Austin, TX",
  requestedLimit: 20,
  country: "United States",
  state: "TX",
  city: "Austin",
  category: "Plumbing",
};

const input = {
  source: "fixture-business-directory",
  searchQuery: "plumbers",
  location: "Austin, TX",
  requestedLimit: 20,
} as const;

describe("scraping job service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(countRecentOwnedJobsBySource).mockResolvedValue(0);
    vi.mocked(createScrapingJobRecord).mockResolvedValue(pendingRecord);
    vi.mocked(enqueueScrapingJob).mockResolvedValue({
      id: "queue-1",
    } as Awaited<ReturnType<typeof enqueueScrapingJob>>);
    vi.mocked(markScrapingJobQueued).mockResolvedValue();
    vi.mocked(markScrapingJobEnqueueFailed).mockResolvedValue();
    vi.mocked(findOwnedScrapingJobSummary).mockResolvedValue({
      ...pendingRecord,
      status: "QUEUED",
    });
  });

  it("derives ownership from the service argument and maps the public source to the queue adapter", async () => {
    const result = await createScrapingJob("user-1", input);

    expect(createScrapingJobRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        ...input,
        city: "Austin",
        state: "TX",
      }),
    );
    expect(enqueueScrapingJob).toHaveBeenCalledWith(
      expect.objectContaining({
        scrapingJobId: pendingRecord.id,
        requestedById: "user-1",
        source: "fixture-business-directory",
        sourceKey: "fixture-directory",
        city: "Austin",
        state: "TX",
      }),
    );
    expect(markScrapingJobQueued).toHaveBeenCalledWith(
      pendingRecord.id,
      "user-1",
      "queue-1",
    );
    expect(result.job.status).toBe("QUEUED");
  });

  it("records a safe failed state when BullMQ enqueueing fails", async () => {
    vi.mocked(enqueueScrapingJob).mockRejectedValue(new Error("redis secret detail"));

    await expect(createScrapingJob("user-1", input)).rejects.toMatchObject({
      code: "QUEUE_UNAVAILABLE",
      statusCode: 503,
    });
    expect(markScrapingJobEnqueueFailed).toHaveBeenCalledWith(
      pendingRecord.id,
      "user-1",
    );
  });

  it("rejects a disabled approved development source before persisting a job", async () => {
    vi.mocked(assertAutomatedAccessAllowed).mockRejectedValueOnce(
      sourceNotPermittedError(),
    );

    await expect(
      createScrapingJob("user-1", {
        ...input,
        source: "permitted-http-directory",
      }),
    ).rejects.toMatchObject({
      code: "SOURCE_NOT_PERMITTED",
      statusCode: 400,
    });
    expect(createScrapingJobRecord).not.toHaveBeenCalled();
    expect(enqueueScrapingJob).not.toHaveBeenCalled();
  });

  it("returns a fast worker's actual status without moving it back to QUEUED", async () => {
    vi.mocked(findOwnedScrapingJobSummary).mockResolvedValue({
      ...pendingRecord,
      status: "RUNNING",
      startedAt: createdAt,
      progressPercentage: 5,
    });

    const result = await createScrapingJob("user-1", input);

    expect(result.job.status).toBe("RUNNING");
  });

  it("best-effort removes an enqueued job if the database queue transition fails", async () => {
    vi.mocked(markScrapingJobQueued).mockRejectedValue(
      new Error("database unavailable"),
    );
    vi.mocked(removeScrapingQueueJob).mockResolvedValue(true);

    await expect(createScrapingJob("user-1", input)).rejects.toMatchObject({
      code: "QUEUE_UNAVAILABLE",
    });
    expect(removeScrapingQueueJob).toHaveBeenCalledWith("queue-1");
    expect(markScrapingJobEnqueueFailed).toHaveBeenCalledWith(
      pendingRecord.id,
      "user-1",
    );
  });

  it("returns the same not-found response for an absent or unowned detail", async () => {
    vi.mocked(findOwnedScrapingJobDetail).mockResolvedValue(null);

    await expect(getScrapingJob("user-1", pendingRecord.id)).rejects.toMatchObject({
      code: "SCRAPING_JOB_NOT_FOUND",
      statusCode: 404,
    });
    expect(findOwnedScrapingJobDetail).toHaveBeenCalledWith(
      pendingRecord.id,
      "user-1",
    );
  });

  it("marks cancellation in the database before attempting best-effort queue removal", async () => {
    vi.mocked(findOwnedScrapingJobDetail)
      .mockResolvedValueOnce(detailRecord)
      .mockResolvedValueOnce({
        ...detailRecord,
        status: "CANCELLED",
        cancelledAt: createdAt,
      });
    vi.mocked(cancelOwnedScrapingJob).mockResolvedValue(true);
    vi.mocked(removeScrapingQueueJob).mockResolvedValue(true);

    const result = await cancelScrapingJob("user-1", pendingRecord.id);

    expect(result.status).toBe("CANCELLED");
    expect(cancelOwnedScrapingJob).toHaveBeenCalledWith(
      pendingRecord.id,
      "user-1",
    );
    expect(removeScrapingQueueJob).toHaveBeenCalledWith("queue-1");
    expect(
      vi.mocked(cancelOwnedScrapingJob).mock.invocationCallOrder[0],
    ).toBeLessThan(
      vi.mocked(removeScrapingQueueJob).mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("rejects cancellation for terminal jobs without mutating them", async () => {
    vi.mocked(findOwnedScrapingJobDetail).mockResolvedValue({
      ...detailRecord,
      status: "COMPLETED",
    });

    await expect(
      cancelScrapingJob("user-1", pendingRecord.id),
    ).rejects.toMatchObject({ code: "SCRAPING_JOB_NOT_CANCELLABLE" });
    expect(cancelOwnedScrapingJob).not.toHaveBeenCalled();
  });

  it("keeps database cancellation authoritative when queue removal fails", async () => {
    vi.mocked(findOwnedScrapingJobDetail)
      .mockResolvedValueOnce(detailRecord)
      .mockResolvedValueOnce({
        ...detailRecord,
        status: "CANCELLED",
        cancelledAt: createdAt,
      });
    vi.mocked(cancelOwnedScrapingJob).mockResolvedValue(true);
    vi.mocked(removeScrapingQueueJob).mockRejectedValue(
      new Error("job is active"),
    );

    await expect(
      cancelScrapingJob("user-1", pendingRecord.id),
    ).resolves.toMatchObject({ status: "CANCELLED" });
  });

  it("creates a new linked job when retrying an owned failed job", async () => {
    vi.mocked(findOwnedScrapingJobForRetry).mockResolvedValue(retryRecord);

    await retryScrapingJob("user-1", pendingRecord.id);

    expect(createScrapingJobRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        retryOfJobId: pendingRecord.id,
        source: "fixture-business-directory",
        searchQuery: "plumbers",
      }),
    );
  });

  it("rejects retries of non-failed jobs", async () => {
    vi.mocked(findOwnedScrapingJobForRetry).mockResolvedValue({
      ...retryRecord,
      status: "RUNNING",
    });

    await expect(
      retryScrapingJob("user-1", pendingRecord.id),
    ).rejects.toMatchObject({ code: "SCRAPING_JOB_NOT_RETRYABLE" });
    expect(createScrapingJobRecord).not.toHaveBeenCalled();
  });
});
