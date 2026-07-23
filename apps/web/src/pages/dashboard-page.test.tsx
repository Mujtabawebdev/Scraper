import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { createAppStore } from "../app/store";
import { setCredentials } from "../features/auth/store/auth.slice";
import { renderWithStore } from "../test/render-with-store";
import { DashboardPage } from "./dashboard-page";

const dashboardMocks = vi.hoisted(() => ({
  useDashboardSummary: vi.fn(),
}));

vi.mock("../features/dashboard/hooks/use-dashboard-summary", () => ({
  useDashboardSummary: dashboardMocks.useDashboardSummary,
}));

describe("DashboardPage", () => {
  it("renders real user-specific summary values", () => {
    dashboardMocks.useDashboardSummary.mockReturnValue({
      data: {
        totalJobs: 12,
        activeJobs: 2,
        completedJobs: 8,
        failedJobs: 2,
        totalLeads: 345,
        leadsWithPhone: 300,
        leadsWithEmail: 210,
      },
      error: null,
      isError: false,
      isLoading: false,
      refetch: vi.fn(),
    });
    const store = createAppStore();
    store.dispatch(
      setCredentials({
        accessToken: "memory-only-token",
        user: {
          id: "user-1",
          fullName: "Ayesha Khan",
          email: "ayesha@example.com",
          role: "USER",
          status: "ACTIVE",
          createdAt: "2026-07-23T12:00:00.000Z",
        },
      }),
    );

    renderWithStore(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
      { store },
    );

    expect(screen.getByRole("heading", { name: "Welcome, Ayesha" })).toBeInTheDocument();
    expect(screen.getByText("345")).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getByText("210")).toBeInTheDocument();
    expect(
      screen.queryByText(/placeholders/i),
    ).not.toBeInTheDocument();
  });
});
