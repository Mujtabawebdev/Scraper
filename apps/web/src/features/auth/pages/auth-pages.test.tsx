import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "../../../services/api-client";
import type {
  LoginFormValues,
  RegisterFormValues,
} from "../schemas/auth.schemas";
import { LoginPage } from "./login-page";
import { RegisterPage } from "./register-page";

const pageMocks = vi.hoisted(() => ({
  login: vi.fn<(input: LoginFormValues) => Promise<unknown>>(),
  register: vi.fn<(input: RegisterFormValues) => Promise<unknown>>(),
  toastSuccess: vi.fn<(message: string) => void>(),
}));

vi.mock("../hooks/use-login", () => ({
  useLogin: () => ({
    isPending: false,
    mutateAsync: pageMocks.login,
  }),
}));

vi.mock("../hooks/use-register", () => ({
  useRegister: () => ({
    isPending: false,
    mutateAsync: pageMocks.register,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: pageMocks.toastSuccess,
  },
}));

const strongPassword = "StrongPassword123!";

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route element={<LoginPage />} path="/login" />
        <Route element={<h1>Dashboard destination</h1>} path="/dashboard" />
      </Routes>
    </MemoryRouter>,
  );
}

function renderRegisterPage() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route element={<RegisterPage />} path="/register" />
        <Route element={<h1>Dashboard destination</h1>} path="/dashboard" />
      </Routes>
    </MemoryRouter>,
  );
}

async function completeLoginForm(
  email = "john@example.com",
  password = strongPassword,
): Promise<void> {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email address"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

async function completeRegistrationForm(
  options: {
    confirmPassword?: string;
    email?: string;
    fullName?: string;
    password?: string;
  } = {},
): Promise<void> {
  const user = userEvent.setup();
  const password = options.password ?? strongPassword;

  await user.type(
    screen.getByLabelText("Full name"),
    options.fullName ?? "John Smith",
  );
  await user.type(
    screen.getByLabelText("Email address"),
    options.email ?? "john@example.com",
  );
  await user.type(screen.getByLabelText(/^Password$/), password);
  await user.type(
    screen.getByLabelText("Confirm password"),
    options.confirmPassword ?? password,
  );
  await user.click(screen.getByRole("button", { name: "Create account" }));
}

describe("LoginPage", () => {
  beforeEach(() => {
    pageMocks.login.mockResolvedValue(undefined);
    pageMocks.register.mockResolvedValue(undefined);
  });

  it("shows client-side validation errors without calling login", async () => {
    renderLoginPage();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("Enter a valid email address"),
    ).toBeInTheDocument();
    expect(await screen.findByText("Password is required")).toBeInTheDocument();
    expect(pageMocks.login).not.toHaveBeenCalled();
  });

  it("submits normalized credentials and navigates after login", async () => {
    renderLoginPage();

    await completeLoginForm("  JOHN@EXAMPLE.COM ");

    expect(
      await screen.findByRole("heading", { name: "Dashboard destination" }),
    ).toBeInTheDocument();
    expect(pageMocks.login).toHaveBeenCalledWith({
      email: "john@example.com",
      password: strongPassword,
    });
    expect(pageMocks.toastSuccess).toHaveBeenCalledWith(
      "Signed in successfully",
    );
  });

  it("shows a safe generic credential error after login failure", async () => {
    pageMocks.login.mockRejectedValue(
      new ApiClientError("Invalid email or password.", {
        status: 401,
        code: "INVALID_CREDENTIALS",
      }),
    );
    renderLoginPage();

    await completeLoginForm();

    expect(
      await screen.findByRole("alert", {
        name: "",
      }),
    ).toHaveTextContent("Invalid email or password.");
    expect(
      screen.queryByRole("heading", { name: "Dashboard destination" }),
    ).not.toBeInTheDocument();
  });
});

describe("RegisterPage", () => {
  beforeEach(() => {
    pageMocks.login.mockResolvedValue(undefined);
    pageMocks.register.mockResolvedValue(undefined);
  });

  it("rejects a weak password before registration", async () => {
    renderRegisterPage();

    await completeRegistrationForm({ password: "weak" });

    expect(
      await screen.findByText("Password must contain at least 8 characters"),
    ).toBeInTheDocument();
    expect(pageMocks.register).not.toHaveBeenCalled();
  });

  it("rejects a confirmation-password mismatch", async () => {
    renderRegisterPage();

    await completeRegistrationForm({
      confirmPassword: "DifferentPassword123!",
    });

    expect(
      await screen.findByText("Passwords do not match"),
    ).toBeInTheDocument();
    expect(pageMocks.register).not.toHaveBeenCalled();
  });

  it("submits normalized registration data and navigates", async () => {
    renderRegisterPage();

    await completeRegistrationForm({
      email: "  JOHN@EXAMPLE.COM ",
      fullName: "  John    Smith  ",
    });

    expect(
      await screen.findByRole("heading", { name: "Dashboard destination" }),
    ).toBeInTheDocument();
    expect(pageMocks.register).toHaveBeenCalledWith({
      fullName: "John Smith",
      email: "john@example.com",
      password: strongPassword,
      confirmPassword: strongPassword,
    });
    expect(pageMocks.toastSuccess).toHaveBeenCalledWith(
      "Account created successfully",
    );
  });

  it("shows the duplicate-email error without exposing raw details", async () => {
    pageMocks.register.mockRejectedValue(
      new ApiClientError(
        "An account with this email address already exists.",
        {
          status: 409,
          code: "EMAIL_ALREADY_IN_USE",
        },
      ),
    );
    renderRegisterPage();

    await completeRegistrationForm();

    expect(
      await screen.findByText(
        "An account with this email address already exists.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Dashboard destination" }),
    ).not.toBeInTheDocument();
  });
});
