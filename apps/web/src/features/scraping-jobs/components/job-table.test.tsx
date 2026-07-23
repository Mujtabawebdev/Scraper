import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { ScrapingJobSummary } from "../types/scraping-job.types";
import { JobTable } from "./job-table";

const runningJob: ScrapingJobSummary = {
  id: "job-running",
  source: "fixture-business-directory",
  status: "RUNNING",
  searchQuery: "plumbers",
  location: "Austin, TX",
  requestedLimit: 25,
  processedCount: 10,
  successCount: 8,
  failureCount: 1,
  duplicateCount: 1,
  progressPercentage: 40,
  pipelineStage: "PERSIST_LEAD",
  createdAt: "2026-07-23T12:00:00.000Z",
  startedAt: "2026-07-23T12:00:01.000Z",
  completedAt: null,
  failedAt: null,
  cancelledAt: null,
};

describe("JobTable", () => {
  it("renders status text, accessible progress, and allowed actions", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onRetry = vi.fn();

    render(
      <MemoryRouter>
        <JobTable
          jobs={[runningJob]}
          onCancel={onCancel}
          onRetry={onRetry}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Progress for plumbers" }),
    ).toHaveAttribute("aria-valuenow", "40");
    expect(
      screen.queryByRole("button", { name: /retry job/i }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Cancel job job-running" }),
    );
    expect(onCancel).toHaveBeenCalledWith(runningJob);
    expect(onRetry).not.toHaveBeenCalled();
  });
});
