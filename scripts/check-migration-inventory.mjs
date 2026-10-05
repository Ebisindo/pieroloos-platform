import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsPath = path.join(root, "prisma", "migrations");
const lockPath = path.join(migrationsPath, "migration_lock.toml");
const lock = await readFile(lockPath, "utf8");

if (!/^\s*provider\s*=\s*"postgresql"\s*$/m.test(lock)) {
  throw new Error("prisma/migrations/migration_lock.toml must declare provider = \"postgresql\".");
}

const entries = await readdir(migrationsPath, { withFileTypes: true });
const migrations = [];
const timestamps = new Set();

for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  const directory = path.join(migrationsPath, entry.name);
  const contents = await readdir(directory);

  if (contents.length === 0) {
    throw new Error(`Empty migration directory is not allowed: ${entry.name}`);
  }

  if (!/^\d{14}_[a-z0-9_]+$/.test(entry.name)) {
    throw new Error(`Invalid migration directory name: ${entry.name}`);
  }

  const timestamp = entry.name.slice(0, 14);
  if (timestamps.has(timestamp)) {
    throw new Error(`Duplicate migration timestamp: ${timestamp}`);
  }
  timestamps.add(timestamp);

  if (contents.length !== 1 || contents[0] !== "migration.sql") {
    throw new Error(`${entry.name} must contain only migration.sql.`);
  }

  const migrationPath = path.join(directory, "migration.sql");
  if ((await stat(migrationPath)).size === 0) {
    throw new Error(`${entry.name}/migration.sql is empty.`);
  }

  migrations.push(entry.name);
}

if (migrations.length === 0) {
  throw new Error("No Prisma SQL migrations were found.");
}

console.log(`Validated ${migrations.length} PostgreSQL migrations in execution order:`);
for (const migration of migrations) {
  console.log(`- ${migration}`);
}
