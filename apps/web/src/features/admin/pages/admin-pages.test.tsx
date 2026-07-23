import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAppStore } from "../../../app/store";
import { setCredentials } from "../../auth/store/auth.slice";
import { renderWithStore } from "../../../test/render-with-store";
import { AdminAuditLogsPage } from "./admin-audit-logs-page";
import { AdminJobsPage } from "./admin-jobs-page";
import { AdminOverviewPage } from "./admin-overview-page";
import { AdminSourcesPage } from "./admin-sources-page";
import { AdminUsersPage } from "./admin-users-page";

const mocks = vi.hoisted(() => ({
  useAdminSummary: vi.fn(),
  useAdminUsers: vi.fn(),
  useAdminJobs: vi.fn(),
  useAdminAuditLogs: vi.fn(),
  useAdminSources: vi.fn(),
  useAdminMutations: vi.fn(),
}));

vi.mock("../hooks/use-admin", () => mocks);

const pagination = {
  page: 1,
  pageSize: 20,
  totalItems: 1,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false,
};

const queryResult = <T,>(data: T) => ({
  data,
  error: null,
  isError: false,
  isFetching: false,
  isLoading: false,
  refetch: vi.fn(),
});

const mutation = () => ({ isPending: false, mutateAsync: vi.fn() });

const adminStore = (role: "ADMIN" | "SUPER_ADMIN" = "ADMIN") => {
  const store = createAppStore();
  store.dispatch(
    setCredentials({
      accessToken: "memory-only-test-token",
      user: {
        id: "admin-1",
        fullName: "Ayesha Admin",
        email: "admin@example.test",
        role,
        status: "ACTIVE",
        createdAt: "2026-07-24T00:00:00.000Z",
      },
    }),
  );
  return store;
};

describe("Phase 8 admin pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAdminMutations.mockReturnValue({
      updateStatus: mutation(),
      updateRole: mutation(),
      cancelJob: mutation(),
      createSource: mutation(),
      updateSource: mutation(),
      disableSource: mutation(),
      reviewSource: mutation(),
    });
  });

  it("renders real admin summary values", () => {
    mocks.useAdminSummary.mockReturnValue(
      queryResult({
        totalUsers: 42,
        activeUsers: 39,
        suspendedUsers: 2,
        disabledUsers: 1,
        usersCreatedToday: 3,
        totalJobs: 120,
        activeJobs: 4,
        completedJobs: 110,
        failedJobs: 5,
        cancelledJobs: 1,
        jobsCreatedToday: 7,
        totalLeads: 900,
        leadsCreatedToday: 33,
        leadsWithPhone: 700,
        leadsWithEmail: 650,
        approvedSources: 2,
        disabledSources: 1,
        blockedSources: 1,
        reviewRequiredSources: 3,
      }),
    );
    renderWithStore(
      <MemoryRouter>
        <AdminOverviewPage />
      </MemoryRouter>,
      { store: adminStore() },
    );
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("900")).toBeInTheDocument();
    expect(screen.getByText("Review required")).toBeInTheDocument();
  });

  it("renders server-driven users and shows role controls only to SUPER_ADMIN", () => {
    mocks.useAdminUsers.mockReturnValue(
      queryResult({
        users: [
          {
            id: "user-1",
            fullName: "Normal User",
            email: "user@example.test",
            role: "USER",
            status: "ACTIVE",
            lastLoginAt: null,
            createdAt: "2026-07-24T00:00:00.000Z",
            updatedAt: "2026-07-24T00:00:00.000Z",
            totalJobs: 5,
            totalLeads: 20,
          },
        ],
        pagination,
      }),
    );
    const { unmount } = renderWithStore(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>,
      { store: adminStore("ADMIN") },
    );
    expect(screen.getByText("Normal User")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Promote" })).not.toBeInTheDocument();
    unmount();

    renderWithStore(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>,
      { store: adminStore("SUPER_ADMIN") },
    );
    expect(screen.getByRole("button", { name: "Promote" })).toBeInTheDocument();
  });

  it("applies user filters, pagination, and confirmed status changes", async () => {
    const updateStatus = mutation();
    updateStatus.mutateAsync.mockResolvedValue({});
    mocks.useAdminMutations.mockReturnValue({
      updateStatus,
      updateRole: mutation(),
      cancelJob: mutation(),
      createSource: mutation(),
      updateSource: mutation(),
      disableSource: mutation(),
      reviewSource: mutation(),
    });
    mocks.useAdminUsers.mockReturnValue(
      queryResult({
        users: [
          {
            id: "user-1",
            fullName: "Managed User",
            email: "managed@example.test",
            role: "USER",
            status: "ACTIVE",
            lastLoginAt: null,
            createdAt: "2026-07-24T00:00:00.000Z",
            updatedAt: "2026-07-24T00:00:00.000Z",
            totalJobs: 1,
            totalLeads: 2,
          },
        ],
        pagination: {
          ...pagination,
          totalItems: 21,
          totalPages: 2,
          hasNextPage: true,
        },
      }),
    );
    const user = userEvent.setup();
    renderWithStore(
      <MemoryRouter>
        <AdminUsersPage />
      </MemoryRouter>,
      { store: adminStore("ADMIN") },
    );

    await user.selectOptions(screen.getByLabelText("Filter by role"), "ADMIN");
    expect(mocks.useAdminUsers).toHaveBeenLastCalledWith(
      expect.objectContaining({ role: "ADMIN", page: 1 }),
    );
    await user.click(screen.getByRole("button", { name: "Go to next page" }));
    expect(mocks.useAdminUsers).toHaveBeenLastCalledWith(
      expect.objectContaining({ role: "ADMIN", page: 2 }),
    );

    await user.click(screen.getByRole("button", { name: "Suspend" }));
    expect(
      screen.getByText(/revokes all active sessions/i),
    ).toBeInTheDocument();
    await user.type(
      screen.getByLabelText("Reason"),
      "Confirmed policy violation",
    );
    await user.click(screen.getByRole("button", { name: "Change status" }));
    await waitFor(() =>
      expect(updateStatus.mutateAsync).toHaveBeenCalledWith({
        userId: "user-1",
        status: "SUSPENDED",
        reason: "Confirmed policy violation",
      }),
    );
  });

  it("renders monitored jobs with owner and cancellation action", () => {
    mocks.useAdminJobs.mockReturnValue(
      queryResult({
        jobs: [
          {
            id: "job-1",
            owner: {
              id: "user-1",
              fullName: "Job Owner",
              email: "owner@example.test",
            },
            source: "permitted-http-directory",
            status: "RUNNING",
            searchQuery: "plumbers",
            location: "Austin, TX",
            requestedLimit: 20,
            processedCount: 4,
            successCount: 3,
            failureCount: 0,
            duplicateCount: 1,
            progressPercentage: 30,
            leadCount: 3,
            createdAt: "2026-07-24T00:00:00.000Z",
            startedAt: "2026-07-24T00:01:00.000Z",
            completedAt: null,
            failedAt: null,
            cancelledAt: null,
          },
        ],
        pagination,
      }),
    );
    renderWithStore(
      <MemoryRouter>
        <AdminJobsPage />
      </MemoryRouter>,
      { store: adminStore() },
    );
    expect(screen.getByText("owner@example.test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("renders only safe audit summaries", () => {
    mocks.useAdminAuditLogs.mockReturnValue(
      queryResult({
        auditLogs: [
          {
            id: "audit-1",
            action: "ADMIN_USER_STATUS_CHANGED",
            actor: {
              id: "admin-1",
              fullName: "Ayesha Admin",
              email: "admin@example.test",
            },
            targetUser: null,
            entityType: "USER",
            entityId: "user-1",
            metadata: null,
            summary: "User status changed from ACTIVE to SUSPENDED",
            createdAt: "2026-07-24T00:00:00.000Z",
          },
        ],
        pagination,
      }),
    );
    renderWithStore(
      <MemoryRouter>
        <AdminAuditLogsPage />
      </MemoryRouter>,
      { store: adminStore() },
    );
    expect(
      screen.getByText("User status changed from ACTIVE to SUSPENDED"),
    ).toBeInTheDocument();
  });

  it("renders blocked and review-required source states", () => {
    mocks.useAdminSources.mockReturnValue(
      queryResult({
        sources: [
          {
            id: "source-1",
            key: "blocked-directory",
            displayName: "Blocked Directory",
            sourceType: "PUBLIC_DIRECTORY",
            baseUrl: "https://example.test",
            status: "BLOCKED",
            isEnabled: false,
            requiresApiKey: false,
            allowsAutomatedAccess: false,
            requestsPerMinute: 5,
            maxConcurrency: 1,
            robotsPolicyCheckedAt: null,
            termsReviewedAt: null,
            reviewNotes: null,
            blockedReason: "Automated access prohibited",
            createdAt: "2026-07-24T00:00:00.000Z",
            updatedAt: "2026-07-24T00:00:00.000Z",
            createdBy: null,
            updatedBy: null,
          },
          {
            id: "source-2",
            key: "review-directory",
            displayName: "Review Directory",
            sourceType: "OFFICIAL_WEBSITE",
            baseUrl: null,
            status: "REVIEW_REQUIRED",
            isEnabled: false,
            requiresApiKey: false,
            allowsAutomatedAccess: false,
            requestsPerMinute: 5,
            maxConcurrency: 1,
            robotsPolicyCheckedAt: null,
            termsReviewedAt: null,
            reviewNotes: "Review needed",
            blockedReason: null,
            createdAt: "2026-07-24T00:00:00.000Z",
            updatedAt: "2026-07-24T00:00:00.000Z",
            createdBy: null,
            updatedBy: null,
          },
        ],
        pagination: { ...pagination, totalItems: 2 },
      }),
    );
    renderWithStore(
      <MemoryRouter>
        <AdminSourcesPage />
      </MemoryRouter>,
      { store: adminStore("SUPER_ADMIN") },
    );
    expect(screen.getByText("BLOCKED")).toBeInTheDocument();
    expect(screen.getByText("REVIEW REQUIRED")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create source" })).toBeInTheDocument();
  });
});
