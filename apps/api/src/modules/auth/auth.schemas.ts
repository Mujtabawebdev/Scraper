import { z } from "zod";

const normalizedEmailSchema = z
  .string()
  .trim()
  .max(320)
  .transform((value) => value.toLowerCase())
  .pipe(z.email("A valid email address is required"));

const normalizedFullNameSchema = z
  .string()
  .transform((value) => value.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(2, "Full name must contain at least 2 characters")
      .max(100, "Full name must contain at most 100 characters"),
  );

const strongPasswordSchema = z
  .string()
  .min(8, "Password must contain at least 8 characters")
  .max(128, "Password must contain at most 128 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

export const registerSchema = z
  .object({
    fullName: normalizedFullNameSchema,
    email: normalizedEmailSchema,
    password: strongPasswordSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: normalizedEmailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export const emptyAuthBodySchema = z.preprocess(
  (value) => (value === undefined ? {} : value),
  z.object({}).strict(),
);
