import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ScrapingJobDetail,
  ScrapingJobStatus,
} from "../types/scraping-job.types";
import {
  ACTIVE_JOB_POLL_INTERVAL_MS,
  useScrapingJob,
} from "./use-scraping-job";

const apiMocks = vi.hoisted(() => ({
  getScrapingJob: vi.fn(),
}));

vi.mock("../api/scraping-jobs.api", () => ({
  getScrapingJob: apiMocks.getScrapingJob,
}));

const createJob = (status: ScrapingJobStatus): ScrapingJobDetail => ({
  id: "job-1",
  source: "fixture-business-directory",
  status,
  searchQuery: "plumbers",
  location: "Austin, TX",
  requestedLimit: 25,
  processedCount: status === "COMPLETED" ? 25 : 5,
  successCount: status === "COMPLETED" ? 23 : 5,
  failureCount: 0,
  duplicateCount: status === "COMPLETED" ? 2 : 0,
  progressPercentage: status === "COMPLETED" ? 100 : 20,
  createdAt: "2026-07-23T12:00:00.000Z",
  startedAt: "2026-07-23T12:00:01.000Z",
  completedAt:
    status === "COMPLETED" ? "2026-07-23T12:01:00.000Z" : null,
  failedAt: null,
  cancelledAt: null,
  updatedAt: "2026-07-23T12:00:10.000Z",
  errorMessage: null,
  leadCount: status === "COMPLETED" ? 23 : 5,
  canCancel: status === "RUNNING",
  canRetry: false,
  retryOfJobId: null,
});

describe("useScrapingJob polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    apiMocks.getScrapingJob.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls an active job and stops after it becomes terminal", async () => {
    let status: ScrapingJobStatus = "RUNNING";
    apiMocks.getScrapingJob.mockImplementation(async () => createJob(status));
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    const Wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
    const { result, unmount } = renderHook(() => useScrapingJob("job-1"), {
      wrapper: Wrapper,
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.data?.status).toBe("RUNNING");
    expect(apiMocks.getScrapingJob).toHaveBeenCalledTimes(1);

    status = "COMPLETED";
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACTIVE_JOB_POLL_INTERVAL_MS + 10);
      await Promise.resolve();
    });
    expect(result.current.data?.status).toBe("COMPLETED");
    expect(apiMocks.getScrapingJob).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(ACTIVE_JOB_POLL_INTERVAL_MS * 3);
    });
    expect(apiMocks.getScrapingJob).toHaveBeenCalledTimes(2);

    unmount();
    queryClient.clear();
  });
});
