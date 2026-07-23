import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CreateScrapingJobFormValues } from "../schemas/scraping-job.schemas";
import type { ScrapingJobSummary } from "../types/scraping-job.types";
import { CreateJobPage } from "./create-job-page";

const pageMocks = vi.hoisted(() => ({
  create: vi.fn<
    (input: CreateScrapingJobFormValues) => Promise<ScrapingJobSummary>
  >(),
  toastSuccess: vi.fn<(message: string) => void>(),
}));

vi.mock("../hooks/use-create-scraping-job", () => ({
  useCreateScrapingJob: () => ({
    isPending: false,
    mutateAsync: pageMocks.create,
  }),
}));

vi.mock("../../sources/hooks/use-available-sources", () => ({
  useAvailableSources: () => ({
    data: [
      { key: "google-places-api", displayName: "Google Places API", state: "AVAILABLE", canCreateJob: true },
      { key: "government-dataset", displayName: "Government Dataset", state: "AVAILABLE", canCreateJob: true },
    ],
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: pageMocks.toastSuccess,
  },
}));

const createdJob: ScrapingJobSummary = {
  id: "job-created",
  source: "google-places-api",
  status: "QUEUED",
  searchQuery: "plumbers",
  location: "Austin, TX",
  requestedLimit: 10,
  processedCount: 0,
  successCount: 0,
  failureCount: 0,
  duplicateCount: 0,
  progressPercentage: 0,
  pipelineStage: "DISCOVER_BUSINESSES",
  createdAt: "2026-07-23T12:00:00.000Z",
  startedAt: null,
  completedAt: null,
  failedAt: null,
  cancelledAt: null,
};

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/dashboard/jobs/new"]}>
        <Routes>
          <Route
            element={<CreateJobPage />}
            path="/dashboard/jobs/new"
          />
          <Route
            element={<h1>Created job detail</h1>}
            path="/dashboard/jobs/:jobId"
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe("CreateJobPage", () => {
  beforeEach(() => {
    pageMocks.create.mockReset();
    pageMocks.toastSuccess.mockReset();
    pageMocks.create.mockResolvedValue(createdJob);
  });

  it("queues normalized criteria and navigates to job detail", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByLabelText("Search query or category"),
      "  plumbers  ",
    );
    await user.type(screen.getByLabelText("Location"), "  Austin, TX  ");
    await user.clear(screen.getByLabelText("Requested lead limit"));
    await user.type(screen.getByLabelText("Requested lead limit"), "10");
    await user.click(screen.getByRole("button", { name: "Queue scraping job" }));

    expect(
      await screen.findByRole("heading", { name: "Created job detail" }),
    ).toBeInTheDocument();
    expect(pageMocks.create).toHaveBeenCalledWith({
      source: "google-places-api",
      searchQuery: "plumbers",
      location: "Austin, TX",
      requestedLimit: 10,
    });
    expect(pageMocks.toastSuccess).toHaveBeenCalledWith(
      "Scraping job queued successfully.",
    );
  });
});
