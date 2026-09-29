# PieroloOS — Lint / Typecheck Fix

This package corrects the npm script configuration that caused:

`Invalid project directory provided, no such directory: /workspace/pieroloos-platform/lint`

## Correct scripts

- `npm run lint` → `eslint .`
- `npm run typecheck` → `tsc --noEmit`

## Installation

From the repository root:

```bash
npm install
```

Then run:

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm run build
```

## Important

Do not run:

```bash
npm run typecheck lint
```

because `lint` becomes an argument to TypeScript.

The correct commands are separate:

```bash
npm run lint
npm run typecheck
```

The package also includes `eslint` and `eslint-config-next`, which are required by the new lint script.
