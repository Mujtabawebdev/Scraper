import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  envDir: "../../",
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,
    env: {
      VITE_API_BASE_URL: "http://localhost:5000/api/v1",
      VITE_APP_NAME: "US Business Lead SaaS",
    },
  },
});
