import { z } from "zod";

export const normalizedEmailSchema = z
  .string()
  .trim()
  .max(320, "Email must contain at most 320 characters")
  .transform((value) => value.toLowerCase())
  .pipe(z.email("Enter a valid email address"));

export const normalizedFullNameSchema = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(2, "Full name must contain at least 2 characters")
      .max(100, "Full name must contain at most 100 characters"),
  );

export const strongPasswordSchema = z
  .string()
  .min(8, "Password must contain at least 8 characters")
  .max(128, "Password must contain at most 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

export const loginFormSchema = z
  .object({
    email: normalizedEmailSchema,
    password: z
      .string()
      .min(1, "Password is required")
      .max(128, "Password must contain at most 128 characters"),
  })
  .strict();

export const registerFormSchema = z
  .object({
    fullName: normalizedFullNameSchema,
    email: normalizedEmailSchema,
    password: strongPasswordSchema,
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .strict()
  .refine(({ confirmPassword, password }) => confirmPassword === password, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginFormInput = z.input<typeof loginFormSchema>;
export type LoginFormValues = z.output<typeof loginFormSchema>;
export type RegisterFormInput = z.input<typeof registerFormSchema>;
export type RegisterFormValues = z.output<typeof registerFormSchema>;
