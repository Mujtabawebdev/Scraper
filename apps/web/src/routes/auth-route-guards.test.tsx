import { screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { createAppStore } from "../app/store";
import {
  setCredentials,
  setInitializing,
} from "../features/auth/store/auth.slice";
import type {
  AuthUser,
  UserRole,
} from "../features/auth/types/auth.types";
import { renderWithStore } from "../test/render-with-store";
import { ProtectedRoute } from "./protected-route";
import { PublicOnlyRoute } from "./public-only-route";
import { RoleRoute } from "./role-route";

const createUser = (role: UserRole = "USER"): AuthUser => ({
  id: "3c9b27c1-6a50-4b31-a30d-0048e995cf83",
  fullName: "John Smith",
  email: "john@example.com",
  role,
  status: "ACTIVE",
  lastLoginAt: "2026-07-23T12:00:00.000Z",
  createdAt: "2026-07-22T12:00:00.000Z",
  updatedAt: "2026-07-23T12:00:00.000Z",
});

const createReadyStore = () => {
  const store = createAppStore();
  store.dispatch(setInitializing(false));
  return store;
};

const authenticate = (
  store: ReturnType<typeof createAppStore>,
  role: UserRole = "USER",
): void => {
  store.dispatch(
    setCredentials({
      accessToken: "in-memory-access-token",
      user: createUser(role),
    }),
  );
};

describe("ProtectedRoute", () => {
  it("redirects an unauthenticated visitor to login", () => {
    const store = createReadyStore();

    renderWithStore(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route element={<h1>Protected dashboard</h1>} path="/dashboard" />
          </Route>
          <Route element={<h1>Login destination</h1>} path="/login" />
        </Routes>
      </MemoryRouter>,
      { store },
    );

    expect(
      screen.getByRole("heading", { name: "Login destination" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Protected dashboard" }),
    ).not.toBeInTheDocument();
  });

  it("renders protected content for an authenticated user", () => {
    const store = createReadyStore();
    authenticate(store);

    renderWithStore(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route element={<h1>Protected dashboard</h1>} path="/dashboard" />
          </Route>
          <Route element={<h1>Login destination</h1>} path="/login" />
        </Routes>
      </MemoryRouter>,
      { store },
    );

    expect(
      screen.getByRole("heading", { name: "Protected dashboard" }),
    ).toBeInTheDocument();
  });
});

describe("PublicOnlyRoute", () => {
  it("redirects an authenticated user away from a public-only page", () => {
    const store = createReadyStore();
    authenticate(store);

    renderWithStore(
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route element={<PublicOnlyRoute />}>
            <Route element={<h1>Public login</h1>} path="/login" />
          </Route>
          <Route element={<h1>Dashboard destination</h1>} path="/dashboard" />
        </Routes>
      </MemoryRouter>,
      { store },
    );

    expect(
      screen.getByRole("heading", { name: "Dashboard destination" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Public login" }),
    ).not.toBeInTheDocument();
  });
});

describe("RoleRoute", () => {
  it("renders nested content for an allowed role", () => {
    const store = createReadyStore();
    authenticate(store, "ADMIN");

    renderWithStore(
      <MemoryRouter initialEntries={["/admin-preview"]}>
        <Routes>
          <Route
            element={<RoleRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]} />}
          >
            <Route
              element={<h1>Authorized role content</h1>}
              path="/admin-preview"
            />
          </Route>
          <Route element={<h1>Unauthorized destination</h1>} path="/unauthorized" />
        </Routes>
      </MemoryRouter>,
      { store },
    );

    expect(
      screen.getByRole("heading", { name: "Authorized role content" }),
    ).toBeInTheDocument();
  });

  it("redirects a user without an allowed role", () => {
    const store = createReadyStore();
    authenticate(store, "USER");

    renderWithStore(
      <MemoryRouter initialEntries={["/admin-preview"]}>
        <Routes>
          <Route
            element={<RoleRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]} />}
          >
            <Route
              element={<h1>Authorized role content</h1>}
              path="/admin-preview"
            />
          </Route>
          <Route element={<h1>Unauthorized destination</h1>} path="/unauthorized" />
        </Routes>
      </MemoryRouter>,
      { store },
    );

    expect(
      screen.getByRole("heading", { name: "Unauthorized destination" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Authorized role content" }),
    ).not.toBeInTheDocument();
  });
});
