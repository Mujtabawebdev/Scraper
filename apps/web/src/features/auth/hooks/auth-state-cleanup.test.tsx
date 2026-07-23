import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider as ReduxProvider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAppStore } from "../../../app/store";
import { authQueryKeys } from "../api/auth-query-keys";
import { logout, logoutAll } from "../api/auth.api";
import { setCredentials } from "../store/auth.slice";
import type { AuthUserSummary } from "../types/auth.types";
import { useLogoutAll } from "./use-logout-all";
import { useLogout } from "./use-logout";

const authApiMocks = vi.hoisted(() => ({
  logout: vi.fn(),
  logoutAll: vi.fn(),
}));

vi.mock("../api/auth.api", () => ({
  logout: authApiMocks.logout,
  logoutAll: authApiMocks.logoutAll,
}));

const mockedLogout = vi.mocked(logout);
const mockedLogoutAll = vi.mocked(logoutAll);

const user: AuthUserSummary = {
  id: "user-1",
  fullName: "Ayesha Khan",
  email: "ayesha@example.com",
  role: "USER",
  status: "ACTIVE",
  createdAt: "2026-07-20T09:30:00.000Z",
};

const createAuthenticatedStore = () => {
  const store = createAppStore();
  store.dispatch(
    setCredentials({
      accessToken: "memory-only-access-token",
      user,
    }),
  );
  return store;
};

function LogoutHarness() {
  const logoutMutation = useLogout();
  const logoutAllMutation = useLogoutAll();

  return (
    <>
      <button type="button" onClick={() => logoutMutation.mutate()}>
        Logout current
      </button>
      <button type="button" onClick={() => logoutAllMutation.mutate()}>
        Logout all
      </button>
    </>
  );
}

describe("auth state storage and logout cleanup", () => {
  beforeEach(() => {
    mockedLogout.mockReset();
    mockedLogoutAll.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("keeps the access token in Redux memory without writing browser storage", () => {
    const storageWrite = vi.spyOn(Storage.prototype, "setItem");

    const store = createAuthenticatedStore();

    expect(store.getState().auth.accessToken).toBe("memory-only-access-token");
    expect(storageWrite).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("clears auth state and cached user data when logout fails", async () => {
    const store = createAuthenticatedStore();
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    queryClient.setQueryData(authQueryKeys.currentUser(), user);
    mockedLogout.mockRejectedValue(new Error("Mocked network failure"));

    render(
      <ReduxProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <LogoutHarness />
        </QueryClientProvider>
      </ReduxProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Logout current" }));

    await waitFor(() => {
      expect(store.getState().auth.isAuthenticated).toBe(false);
    });

    expect(mockedLogout).toHaveBeenCalledOnce();
    expect(store.getState().auth.accessToken).toBeNull();
    expect(store.getState().auth.user).toBeNull();
    expect(queryClient.getQueryData(authQueryKeys.currentUser())).toBeUndefined();
  });

  it("clears auth state and cached user data when logout-all fails", async () => {
    const store = createAuthenticatedStore();
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    queryClient.setQueryData(authQueryKeys.currentUser(), user);
    mockedLogoutAll.mockRejectedValue(new Error("Mocked network failure"));

    render(
      <ReduxProvider store={store}>
        <QueryClientProvider client={queryClient}>
          <LogoutHarness />
        </QueryClientProvider>
      </ReduxProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Logout all" }));

    await waitFor(() => {
      expect(store.getState().auth.isAuthenticated).toBe(false);
    });

    expect(mockedLogoutAll).toHaveBeenCalledOnce();
    expect(store.getState().auth.accessToken).toBeNull();
    expect(store.getState().auth.user).toBeNull();
    expect(queryClient.getQueryData(authQueryKeys.currentUser())).toBeUndefined();
  });
});
