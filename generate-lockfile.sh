#!/usr/bin/env bash
set -euo pipefail

echo "Generating authoritative npm package-lock.json..."
npm install --package-lock-only --ignore-scripts --no-audit --no-fund

test -f package-lock.json
echo "Created package-lock.json successfully."
echo
echo "Next:"
echo "  git add package.json package-lock.json"
echo "  git commit -m 'fix: add authoritative npm lockfile'"
echo "  git push"
