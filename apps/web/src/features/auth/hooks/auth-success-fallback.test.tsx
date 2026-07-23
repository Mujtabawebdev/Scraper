import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { Provider as ReduxProvider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAppStore } from "../../../app/store";
import { ApiClientError } from "../../../services/api-client";
import type {
  AuthSuccessData,
  MessageResponse,
} from "../types/auth.types";
import { useLogin } from "./use-login";
import { useRegister } from "./use-register";

const authApiMocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
}));

vi.mock("../api/auth.api", () => ({
  getCurrentUser: authApiMocks.getCurrentUser,
  login: authApiMocks.login,
  logout: authApiMocks.logout,
  register: authApiMocks.register,
}));

const authentication: AuthSuccessData = {
  accessToken: "memory-only-access-token",
  accessTokenExpiresIn: 900,
  user: {
    id: "user-1",
    fullName: "Ayesha Khan",
    email: "ayesha@example.com",
    role: "USER",
    status: "ACTIVE",
    createdAt: "2026-07-23T12:00:00.000Z",
  },
};

const logoutResponse: MessageResponse = {
  success: true,
  message: "Logged out successfully",
};

const createHarness = () => {
  const store = createAppStore();
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ReduxProvider>
  );

  return { queryClient, store, Wrapper };
};

describe("successful authentication fallback", () => {
  beforeEach(() => {
    authApiMocks.getCurrentUser.mockReset();
    authApiMocks.login.mockReset();
    authApiMocks.logout.mockReset();
    authApiMocks.register.mockReset();
    authApiMocks.login.mockResolvedValue(authentication);
    authApiMocks.register.mockResolvedValue(authentication);
    authApiMocks.logout.mockResolvedValue(logoutResponse);
    authApiMocks.getCurrentUser.mockRejectedValue(
      new ApiClientError("Unable to reach the server.", {
        status: null,
        code: "NETWORK_ERROR",
      }),
    );
  });

  it("keeps a successful login when optional current-user enrichment has a transient failure", async () => {
    const { store, Wrapper } = createHarness();
    const { result } = renderHook(() => useLogin(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        email: "ayesha@example.com",
        password: "StrongPassword123!",
      });
    });

    expect(store.getState().auth).toMatchObject({
      accessToken: authentication.accessToken,
      isAuthenticated: true,
      user: authentication.user,
    });
    expect(authApiMocks.logout).not.toHaveBeenCalled();
  });

  it("keeps a newly created account authenticated when optional enrichment has a transient failure", async () => {
    const { store, Wrapper } = createHarness();
    const { result } = renderHook(() => useRegister(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        fullName: "Ayesha Khan",
        email: "ayesha@example.com",
        password: "StrongPassword123!",
        confirmPassword: "StrongPassword123!",
      });
    });

    expect(authApiMocks.register).toHaveBeenCalledWith({
      fullName: "Ayesha Khan",
      email: "ayesha@example.com",
      password: "StrongPassword123!",
    });
    expect(store.getState().auth).toMatchObject({
      accessToken: authentication.accessToken,
      isAuthenticated: true,
      user: authentication.user,
    });
    expect(authApiMocks.logout).not.toHaveBeenCalled();
  });
});
