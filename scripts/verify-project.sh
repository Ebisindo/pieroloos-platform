#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

echo "PieroloOS project root: $ROOT"

test -f package.json || { echo "ERROR: package.json not found"; exit 1; }
test -f tsconfig.json || { echo "ERROR: tsconfig.json not found"; exit 1; }

echo "=== npm lint ==="
npm --prefix "$ROOT" exec eslint "$ROOT"

echo "=== npm typecheck ==="
npm --prefix "$ROOT" exec tsc --noEmit --project "$ROOT/tsconfig.json"

echo "=== done ==="
