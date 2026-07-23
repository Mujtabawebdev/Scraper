import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  envDir: "../../",
  plugins: [react(), tailwindcss()],
  server: {
    host: "localhost",
    port: 5_173,
    strictPort: true,
  },
  preview: {
    host: "localhost",
    port: 4_173,
    strictPort: true,
  },
});
