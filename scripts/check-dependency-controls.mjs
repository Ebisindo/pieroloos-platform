import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "package.json");
const lockPath = path.join(root, "package-lock.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const lock = JSON.parse(fs.readFileSync(lockPath, "utf8"));
const errors = [];
const report = { lockfileVersion: lock.lockfileVersion, manifestLockDifferences: [], directLatestRanges: [], unpinnedActions: [] };

if (lock.lockfileVersion !== 3) errors.push(`Expected package-lock.json lockfileVersion 3; got ${lock.lockfileVersion ?? "missing"}.`);
const lockedRoot = lock.packages?.[""];
if (!lockedRoot) {
  errors.push('package-lock.json is missing packages[""] root metadata.');
} else {
  for (const group of ["dependencies", "devDependencies", "optionalDependencies"]) {
    const declared = manifest[group] ?? {};
    const locked = lockedRoot[group] ?? {};
    for (const name of new Set([...Object.keys(declared), ...Object.keys(locked)])) {
      if ((declared[name] ?? null) !== (locked[name] ?? null)) {
        report.manifestLockDifferences.push({ group, name, manifest: declared[name] ?? null, lock: locked[name] ?? null });
      }
    }
    for (const [name, range] of Object.entries(declared)) {
      if (range === "latest") report.directLatestRanges.push({ group, name });
    }
  }
  if (report.manifestLockDifferences.length) errors.push("package.json dependency declarations differ from package-lock.json root metadata.");
  if (report.directLatestRanges.length) errors.push("Direct dependencies must not use the floating 'latest' range.");
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : /\.ya?ml$/i.test(entry.name) ? [full] : [];
  });
}

for (const file of walk(path.join(root, ".github", "workflows"))) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    const match = line.match(/^\s*uses:\s*["']?([^"'#\s]+)["']?\s*(?:#.*)?$/);
    if (!match) return;
    const target = match[1];
    if (target.startsWith("./")) return;
    const pinnedAction = /^[^@\s]+@[a-f0-9]{40}$/i.test(target);
    const pinnedContainer = target.startsWith("docker://") && /@sha256:[a-f0-9]{64}$/i.test(target);
    if (!pinnedAction && !pinnedContainer) {
      report.unpinnedActions.push({ file: path.relative(root, file), line: index + 1, uses: target });
    }
  });
}
if (report.unpinnedActions.length) errors.push("Every external GitHub Action must use a full 40-character commit SHA; container actions must use a sha256 digest.");

console.log(JSON.stringify({ ...report, errors }, null, 2));
if (errors.length) process.exitCode = 1;
