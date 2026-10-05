import { spawnSync } from "node:child_process";

const databaseUrl = process.env.DATABASE_URL;
const target = process.env.DATABASE_ENV;

if (!databaseUrl || !["ci", "local"].includes(target)) {
  console.error("Database integration tests require DATABASE_URL and DATABASE_ENV=ci or local.");
  process.exit(2);
}

if (target === "local" && process.env.CONFIRM_LOCAL_DB_TESTS !== "I_HAVE_VERIFIED_THE_LOCAL_TARGET") {
  console.error("Local database tests require CONFIRM_LOCAL_DB_TESTS=I_HAVE_VERIFIED_THE_LOCAL_TARGET.");
  process.exit(2);
}

let parsedUrl;
try {
  parsedUrl = new URL(databaseUrl);
} catch {
  console.error("DATABASE_URL must be a valid PostgreSQL URL.");
  process.exit(2);
}

if (!["postgres:", "postgresql:"].includes(parsedUrl.protocol)) {
  console.error("Database integration tests require PostgreSQL.");
  process.exit(2);
}

const databaseName = decodeURIComponent(parsedUrl.pathname.slice(1));
if (target === "ci" && !/(?:_ci|_test|_integration)$/i.test(databaseName)) {
  console.error("CI database integration tests must use a database ending in _ci, _test, or _integration.");
  process.exit(2);
}

const result = spawnSync(
  "npx",
  ["--no-install", "vitest", "run", "tests/database-integrity.integration.test.ts"],
  {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_INTEGRATION_TESTS: "1" },
    stdio: "inherit",
  },
);

if (result.error) {
  console.error(`Could not run database integration tests: ${result.error.message}`);
  process.exit(result.status ?? 1);
}

process.exit(result.status ?? 1);
