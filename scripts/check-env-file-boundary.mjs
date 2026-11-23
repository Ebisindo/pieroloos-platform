import { execFileSync } from "node:child_process";

const trackedPaths = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0")
  .filter(Boolean);

const allowedTemplate = /^\.env(?:\..+)?\.example$/i;
const blockedPaths = trackedPaths.filter((path) => {
  const basename = path.split(/[\\/]/).at(-1) ?? "";
  return /^\.env/i.test(basename) && !allowedTemplate.test(basename);
});

if (blockedPaths.length > 0) {
  console.error("Tracked environment files are forbidden. Only .env.example and .env.*.example templates are allowed:");
  for (const path of blockedPaths) console.error(` - ${path}`);
  process.exit(1);
}

console.log("Environment-file boundary passed: no real environment files are tracked.");
