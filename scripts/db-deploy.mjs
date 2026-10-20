import { spawnSync } from "node:child_process";

const target = process.argv[2];
const supportedTargets = ["local", "staging", "production", "ci"];

if (!supportedTargets.includes(target)) {
  console.error(`Usage: npm run db:deploy -- <${supportedTargets.join("|")}>`);
  process.exit(2);
}

if (target === "production" && process.env.CONFIRM_PRODUCTION_MIGRATION !== "I_HAVE_VERIFIED_THE_PRODUCTION_TARGET") {
  console.error("Production migrations require CONFIRM_PRODUCTION_MIGRATION=I_HAVE_VERIFIED_THE_PRODUCTION_TARGET.");
  process.exit(2);
}

const suffix = target.toUpperCase();
const databaseUrl = process.env[`DATABASE_URL_${suffix}`];
const shadowDatabaseUrl = process.env[`SHADOW_DATABASE_URL_${suffix}`];

if (!databaseUrl || !shadowDatabaseUrl) {
  console.error(`Set both DATABASE_URL_${suffix} and SHADOW_DATABASE_URL_${suffix} for the selected target.`);
  process.exit(2);
}

function parsePostgresUrl(value, name) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    console.error(`${name} must be a valid PostgreSQL URL.`);
    process.exit(2);
  }
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) || !parsed.pathname || parsed.pathname === "/") {
    console.error(`${name} must be a PostgreSQL URL with a database name.`);
    process.exit(2);
  }
  return parsed;
}

const targetUrl = parsePostgresUrl(databaseUrl, `DATABASE_URL_${suffix}`);
const shadowUrl = parsePostgresUrl(shadowDatabaseUrl, `SHADOW_DATABASE_URL_${suffix}`);

if (
  targetUrl.hostname === shadowUrl.hostname &&
  targetUrl.port === shadowUrl.port &&
  targetUrl.pathname === shadowUrl.pathname
) {
  console.error("The shadow database must be separate from the migration target database.");
  process.exit(2);
}

const env = {
  ...process.env,
  DATABASE_ENV: target,
  DATABASE_URL: databaseUrl,
  SHADOW_DATABASE_URL: shadowDatabaseUrl,
};
const commands = [
  ["db:inventory"],
  ["prisma", "validate"],
  ["prisma", "generate"],
  ["prisma", "migrate", "deploy"],
  ["prisma", "migrate", "status"],
  [
    "prisma",
    "migrate",
    "diff",
    "--from-migrations",
    "prisma/migrations",
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--shadow-database-url",
    shadowDatabaseUrl,
    "--exit-code",
  ],
  [
    "prisma",
    "migrate",
    "diff",
    "--from-url",
    databaseUrl,
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--exit-code",
  ],
];

for (const [command, ...args] of commands) {
  const result =
    command === "db:inventory"
      ? spawnSync("npm", ["run", command], { cwd: process.cwd(), env, stdio: "inherit" })
      : spawnSync("npx", ["--no-install", command, ...args], { cwd: process.cwd(), env, stdio: "inherit" });

  if (result.error) {
    console.error(`Could not run ${command}: ${result.error.message}`);
    process.exit(result.status ?? 1);
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Database target "${target}" is migrated and synchronized with prisma/schema.prisma.`);
