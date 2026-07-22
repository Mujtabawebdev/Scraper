import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: new URL("../../.env", import.meta.url), quiet: true });

const directDatabaseUrl = new URL(env("DIRECT_DATABASE_URL"));

if (directDatabaseUrl.hostname === "localhost") {
  directDatabaseUrl.hostname = "127.0.0.1";
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: directDatabaseUrl.toString(),
  },
});
