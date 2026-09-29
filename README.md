# PieroloOS — Lint / Project Directory Repair

## Why this package exists

The reported error:

```text
pieroloos-platform@0.1.0 typecheck
tsc --noEmit
Invalid project directory provided, no such directory: /workspace/pieroloos-platform/lint
```

does not match the current `package.json` stored in GitHub, which now contains:

```json
"lint": "eslint .",
"typecheck": "tsc --noEmit"
```

This package makes the command boundaries explicit and anchors both lint and typecheck to the current repository root.

## Files

- `package.json` — corrected npm scripts
- `eslint.config.mjs` — Next.js ESLint configuration
- `scripts/verify-project.sh` — root-anchored lint/typecheck diagnostic
- `docs/LINT-PROJECT-DIRECTORY.md` — Codespace instructions

## Codespaces

From the repository root:

```bash
pwd
git rev-parse --show-toplevel
npm install
npm run lint
npm run typecheck
```

If the terminal still reports `/workspace/pieroloos-platform/lint`, run:

```bash
bash scripts/verify-project.sh
```

The diagnostic should print the actual project root and then invoke ESLint and TypeScript with explicit paths.

## Important

Do not run:

```bash
npm run typecheck lint
```

because `lint` can be interpreted as an argument to the TypeScript command.

Run:

```bash
npm run lint
npm run typecheck
```

as separate commands.
