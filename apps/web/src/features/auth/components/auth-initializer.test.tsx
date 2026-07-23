import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { Provider as ReduxProvider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAppStore } from "../../../app/store";
import { getCurrentUser } from "../api/auth.api";
import { authQueryKeys } from "../api/auth-query-keys";
import { setCredentials } from "../store/auth.slice";
import type { User } from "../types/auth.types";
import { AuthInitializer } from "./auth-initializer";
import { refreshAccessToken } from "../../../services/api-client";

vi.mock("../../../services/api-client", () => ({
  connectApiClientToAuth: () => () => undefined,
  refreshAccessToken: vi.fn(),
}));

vi.mock("../api/auth.api", () => ({
  getCurrentUser: vi.fn(),
}));

const mockedRefreshAccessToken = vi.mocked(refreshAccessToken);
const mockedGetCurrentUser = vi.mocked(getCurrentUser);

const currentUser: User = {
  id: "user-1",
  fullName: "Ayesha Khan",
  email: "ayesha@example.com",
  role: "USER",
  status: "ACTIVE",
  lastLoginAt: "2026-07-23T09:30:00.000Z",
  createdAt: "2026-07-20T09:30:00.000Z",
  updatedAt: "2026-07-23T09:30:00.000Z",
};

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

describe("AuthInitializer", () => {
  beforeEach(() => {
    mockedRefreshAccessToken.mockReset();
    mockedGetCurrentUser.mockReset();
  });

  it("restores an access token, loads the current user, and finishes initialization", async () => {
    const store = createAppStore();
    const queryClient = createTestQueryClient();
    mockedRefreshAccessToken.mockImplementation(async () => {
      store.dispatch(
        setCredentials({ accessToken: "restored-in-memory-access-token" }),
      );
      return "restored-in-memory-access-token";
    });
    mockedGetCurrentUser.mockResolvedValue(currentUser);

    render(
      <ReduxProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <AuthInitializer>
            <div>Authenticated application</div>
          </AuthInitializer>
        </QueryClientProvider>
      </ReduxProvider>,
    );

    expect(
      screen.getByText("Restoring your secure session..."),
    ).toBeDefined();

    await waitFor(() => {
      expect(screen.queryByText("Authenticated application")).not.toBeNull();
    });

    expect(mockedRefreshAccessToken).toHaveBeenCalledOnce();
    expect(mockedGetCurrentUser).toHaveBeenCalledOnce();
    expect(store.getState().auth).toMatchObject({
      accessToken: "restored-in-memory-access-token",
      isAuthenticated: true,
      isInitializing: false,
      user: currentUser,
    });
    expect(queryClient.getQueryData(authQueryKeys.currentUser())).toEqual(
      currentUser,
    );
  });

  it("remains logged out and removes stale auth data when restoration fails", async () => {
    const store = createAppStore();
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(authQueryKeys.currentUser(), currentUser);
    mockedRefreshAccessToken.mockRejectedValue(
      new Error("Mocked refresh failure"),
    );

    render(
      <ReduxProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <AuthInitializer>
            <div>Public application</div>
          </AuthInitializer>
        </QueryClientProvider>
      </ReduxProvider>,
    );

    await waitFor(() => {
      expect(screen.queryByText("Public application")).not.toBeNull();
    });

    expect(mockedRefreshAccessToken).toHaveBeenCalledOnce();
    expect(mockedGetCurrentUser).not.toHaveBeenCalled();
    expect(store.getState().auth).toEqual({
      accessToken: null,
      isAuthenticated: false,
      isInitializing: false,
      user: null,
    });
    expect(queryClient.getQueryData(authQueryKeys.currentUser())).toBeUndefined();
  });
});
