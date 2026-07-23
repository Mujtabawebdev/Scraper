import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { config } from "dotenv";
import { Client } from "pg";

const AUTH_TEST_DATABASE_SUFFIX = "_auth_test";
const apiRoot = fileURLToPath(new URL("../", import.meta.url));
const rootEnvironmentFile = new URL("../../../.env", import.meta.url);

export const deriveAuthTestDatabaseUrl = (sourceDatabaseUrl: string): string => {
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(sourceDatabaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (sourceUrl.protocol !== "postgresql:" && sourceUrl.protocol !== "postgres:") {
    throw new Error("DATABASE_URL must use the PostgreSQL protocol");
  }

  const sourceDatabaseName = decodeURIComponent(sourceUrl.pathname.replace(/^\/+/, ""));
  if (!sourceDatabaseName || sourceDatabaseName.includes("/")) {
    throw new Error("DATABASE_URL must include exactly one database name");
  }

  const testDatabaseName = `${sourceDatabaseName}${AUTH_TEST_DATABASE_SUFFIX}`;
  if (
    !testDatabaseName.endsWith(AUTH_TEST_DATABASE_SUFFIX) ||
    testDatabaseName.length > 63 ||
    !/^[A-Za-z0-9_-]+_auth_test$/.test(testDatabaseName)
  ) {
    throw new Error("Derived authentication test database name is not safe");
  }

  const testUrl = new URL(sourceUrl);
  testUrl.pathname = `/${testDatabaseName}`;
  return testUrl.toString();
};

export const getDatabaseName = (databaseUrl: string): string =>
  decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\/+/, ""));

const getPostgresErrorCode = (error: unknown): string | undefined => {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return undefined;
};

const createDatabaseIfMissing = async (
  sourceDatabaseUrl: string,
  testDatabaseUrl: string,
): Promise<void> => {
  const testDatabaseName = getDatabaseName(testDatabaseUrl);
  if (!testDatabaseName.endsWith(AUTH_TEST_DATABASE_SUFFIX)) {
    throw new Error("Refusing to create a database without the auth-test suffix");
  }

  const adminUrl = new URL(sourceDatabaseUrl);
  adminUrl.pathname = "/postgres";
  adminUrl.searchParams.delete("schema");

  const client = new Client({ connectionString: adminUrl.toString() });
  try {
    await client.connect();
    const existing = await client.query<{ datname: string }>(
      "SELECT datname FROM pg_database WHERE datname = $1",
      [testDatabaseName],
    );
    if (existing.rows.length > 0) {
      return;
    }

    const quotedDatabaseName = `"${testDatabaseName.replaceAll('"', '""')}"`;
    try {
      await client.query(`CREATE DATABASE ${quotedDatabaseName}`);
    } catch (error: unknown) {
      if (getPostgresErrorCode(error) !== "42P04") {
        throw error;
      }
    }
  } finally {
    await client.end();
  }
};

const resolvePrismaCli = (): string => {
  const require = createRequire(import.meta.url);
  const prismaPackageJson = require.resolve("prisma/package.json");
  return resolve(dirname(prismaPackageJson), "build", "index.js");
};

const deployMigrations = async (testDatabaseUrl: string): Promise<void> => {
  const prismaCli = resolvePrismaCli();

  await new Promise<void>((resolveMigration, rejectMigration) => {
    const child = spawn(
      process.execPath,
      [prismaCli, "migrate", "deploy", "--schema", "prisma/schema.prisma"],
      {
        cwd: apiRoot,
        env: {
          ...process.env,
          NODE_ENV: "test",
          DATABASE_URL: testDatabaseUrl,
          DIRECT_DATABASE_URL: testDatabaseUrl,
        },
        stdio: "inherit",
      },
    );

    child.once("error", rejectMigration);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolveMigration();
        return;
      }
      rejectMigration(
        new Error(
          signal
            ? `Prisma migration process ended with signal ${signal}`
            : `Prisma migration process exited with code ${code ?? "unknown"}`,
        ),
      );
    });
  });
};

export const prepareAuthTestDatabase = async (): Promise<void> => {
  config({ path: rootEnvironmentFile, quiet: true });

  const sourceDatabaseUrl = process.env.DATABASE_URL;
  if (!sourceDatabaseUrl) {
    throw new Error("DATABASE_URL is required to derive the authentication test database");
  }

  const testDatabaseUrl = deriveAuthTestDatabaseUrl(sourceDatabaseUrl);
  const testDatabaseName = getDatabaseName(testDatabaseUrl);
  if (!testDatabaseName.endsWith(AUTH_TEST_DATABASE_SUFFIX)) {
    throw new Error("Refusing to prepare a database without the auth-test suffix");
  }

  await createDatabaseIfMissing(sourceDatabaseUrl, testDatabaseUrl);
  await deployMigrations(testDatabaseUrl);

  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.DIRECT_DATABASE_URL = testDatabaseUrl;
  const { seedPlanCatalog } = await import("../src/modules/billing/plans/plan-catalog.js");
  const { disconnectDatabase } = await import("../src/infrastructure/database/prisma.js");
  await seedPlanCatalog();
  await disconnectDatabase();

  console.log(`Authentication test database is ready: ${testDatabaseName}`);
};

const invokedScriptPath = process.argv[1];
const isDirectInvocation =
  invokedScriptPath !== undefined &&
  pathToFileURL(resolve(invokedScriptPath)).href === import.meta.url;

if (isDirectInvocation) {
  try {
    await prepareAuthTestDatabase();
  } catch (error: unknown) {
    console.error(
      error instanceof Error
        ? `Authentication test database preparation failed: ${error.message}`
        : "Authentication test database preparation failed",
    );
    process.exitCode = 1;
  }
}
