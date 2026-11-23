import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { Prisma, PrismaClient } from "@prisma/client";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";
import { ESLint } from "eslint";
import { Effect } from "effect";
import { defineConfig as defineViteConfig } from "vite";
import { defineConfig as defineVitestConfig } from "vitest/config";

const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));

const expected = {
  next: "16.4.6",
  prisma: "6.19.3",
  "@prisma/client": "6.19.3",
  vitest: "5.1.1",
  "typescript-eslint": "8.73.0",
  effect: "3.22.1",
  "fast-xml-parser": "5.12.1",
  uuid: "11.1.1",
  minimatch: "11.0.1",
};
for (const [name, version] of Object.entries(expected)) {
  assert.equal(lock.packages?.[`node_modules/${name}`]?.version, version, `${name} lockfile version drifted`);
}
for (const name of ["firebase", "firebase-admin", "eslint", "vite"]) {
  assert.ok(lock.packages?.[`node_modules/${name}`]?.version, `${name} must exist in the lockfile`);
}
for (const [name, range] of Object.entries(manifest.overrides ?? {})) {
  const matching = Object.entries(lock.packages ?? {})
    .filter(([path]) => path === `node_modules/${name}` || path.endsWith(`/node_modules/${name}`))
    .map(([, entry]) => entry.version)
    .filter(Boolean);
  assert.ok(matching.length > 0, `Override target ${name} must exist somewhere in the lockfile`);
  if (/^\d+\.\d+\.\d+$/.test(range)) {
    for (const locked of matching) assert.equal(locked, range, `Override ${name} has a non-overridden nested version`);
  }
}

assert.equal(typeof PrismaClient, "function");
assert.ok(Prisma.PrismaClientKnownRequestError);
assert.equal(typeof applicationDefault, "function");
assert.equal(typeof cert, "function");
assert.equal(typeof getApps, "function");
assert.equal(typeof initializeApp, "function");
assert.equal(typeof getAuth, "function");
assert.equal(typeof getMessaging, "function");
assert.equal(typeof ESLint, "function");
assert.equal(typeof Effect.succeed, "function");
assert.equal(typeof defineViteConfig, "function");
assert.equal(typeof defineVitestConfig, "function");

console.log(JSON.stringify({
  result: "dependency-runtime-import-compatibility-passed",
  verified: [
    "Prisma Client exports and locked version",
    "Firebase Admin App/Auth/Messaging exports without credential initialization",
    "ESLint runtime export",
    "Effect runtime export",
    "Vite and Vitest config exports",
  ],
  note: "Database migration compatibility is exercised by the separate PostgreSQL CI quality job; this check makes no Firebase network calls.",
}, null, 2));
