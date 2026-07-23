import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { createAppStore } from "../app/store";
import {
  setCredentials,
  setInitializing,
} from "../features/auth/store/auth.slice";
import { renderWithStore } from "../test/render-with-store";
import { DashboardLayout } from "./dashboard-layout";

describe("DashboardLayout mobile navigation", () => {
  it("moves focus into the drawer, closes on Escape, and restores trigger focus", async () => {
    const requestAnimationFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0);
        return 1;
      });
    const store = createAppStore();
    store.dispatch(setInitializing(false));
    store.dispatch(
      setCredentials({
        accessToken: "memory-only-access-token",
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
    const queryClient = new QueryClient({
      defaultOptions: {
        mutations: { retry: false },
        queries: { retry: false },
      },
    });
    const user = userEvent.setup();

    renderWithStore(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Routes>
            <Route element={<DashboardLayout />}>
              <Route element={<p>Dashboard content</p>} path="/dashboard" />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
      { store },
    );

    const openButton = screen.getByRole("button", {
      name: "Open navigation menu",
    });
    await user.click(openButton);

    expect(
      screen.getByRole("button", { name: "Close navigation menu" }),
    ).toHaveFocus();
    expect(openButton).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");

    expect(openButton).toHaveFocus();
    expect(openButton).toHaveAttribute("aria-expanded", "false");
    expect(requestAnimationFrame).toHaveBeenCalled();
  });
});
