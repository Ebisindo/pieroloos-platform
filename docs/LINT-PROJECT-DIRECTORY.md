# Lint / Project Directory Diagnostic

The current repository `package.json` on GitHub has separate commands:

```text
lint      -> eslint .
typecheck -> tsc --noEmit
```

Therefore, an error in which `tsc` receives `/workspace/pieroloos-platform/lint` indicates that the actual command being executed by the Codespace shell differs from the expected npm script, or that a command/alias is passing `lint` as an argument.

## Check the root

```bash
pwd
git rev-parse --show-toplevel
```

Both should identify the repository root.

## Check the installed scripts

```bash
npm pkg get scripts
```

## Test commands independently

```bash
npm run lint
```

```bash
npm run typecheck
```

## Explicit diagnostic

```bash
bash scripts/verify-project.sh
```

Do not use `npm run typecheck lint`.
