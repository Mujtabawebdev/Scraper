import { describe, expect, it } from "vitest";

import {
  loginFormSchema,
  registerFormSchema,
  strongPasswordSchema,
} from "./auth.schemas";

describe("authentication schemas", () => {
  it("normalizes registration names and email addresses", () => {
    const result = registerFormSchema.parse({
      fullName: "  John    Smith  ",
      email: "  JOHN.SMITH@EXAMPLE.COM ",
      password: "StrongPassword123!",
      confirmPassword: "StrongPassword123!",
    });

    expect(result.fullName).toBe("John Smith");
    expect(result.email).toBe("john.smith@example.com");
  });

  it.each([
    ["short", "Aa1!", "Password must contain at least 8 characters"],
    [
      "missing uppercase",
      "password123!",
      "Password must contain at least one uppercase letter",
    ],
    [
      "missing lowercase",
      "PASSWORD123!",
      "Password must contain at least one lowercase letter",
    ],
    [
      "missing number",
      "Password!",
      "Password must contain at least one number",
    ],
    [
      "missing special character",
      "Password123",
      "Password must contain at least one special character",
    ],
  ])("rejects a %s password", (_caseName, password, expectedMessage) => {
    const result = strongPasswordSchema.safeParse(password);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        expectedMessage,
      );
    }
  });

  it("rejects a mismatched confirmation password", () => {
    const result = registerFormSchema.safeParse({
      fullName: "John Smith",
      email: "john@example.com",
      password: "StrongPassword123!",
      confirmPassword: "DifferentPassword123!",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toContain(
        "Passwords do not match",
      );
    }
  });

  it("rejects unknown login fields", () => {
    const result = loginFormSchema.safeParse({
      email: "john@example.com",
      password: "StrongPassword123!",
      persistedToken: "must-not-be-accepted",
    });

    expect(result.success).toBe(false);
  });
});
