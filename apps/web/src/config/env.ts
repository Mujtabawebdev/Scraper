import { z } from "zod";

const frontendEnvironmentSchema = z.object({
  VITE_API_BASE_URL: z
    .url("VITE_API_BASE_URL must be a valid URL")
    .refine(
      (value) => value.startsWith("http://") || value.startsWith("https://"),
      "VITE_API_BASE_URL must use HTTP or HTTPS",
    )
    .transform((value) => value.replace(/\/+$/, "")),
  VITE_APP_NAME: z.string().trim().min(1).max(100),
});

const environmentResult = frontendEnvironmentSchema.safeParse({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
});

if (!environmentResult.success) {
  throw new Error(
    `Invalid frontend environment configuration: ${z.prettifyError(environmentResult.error)}`,
  );
}

export const frontendEnvironment = environmentResult.data;
