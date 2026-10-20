# PieroloOS — authoritative package-lock.json

## What this package fixes

GitHub Actions previously failed at `actions/setup-node` because the repository
did not contain `package-lock.json` while npm caching was enabled.

The supplied `package.json` is the exact previous manifest provided for this
repair.

## Generate the real lockfile

Run from this directory:

```bash
npm install --package-lock-only --ignore-scripts --no-audit --no-fund
```

This creates the real `package-lock.json` using npm's dependency resolver.

Do NOT rename `package-lock.template.json` to `package-lock.json`. The template
does not contain the resolved dependency graph and is not suitable for `npm ci`.

## Commit

After generation:

```bash
git add package.json package-lock.json
git commit -m "fix: add authoritative npm lockfile"
git push
```

## CI

Once `package-lock.json` is committed, this is appropriate:

```yaml
- name: Set up Node.js
  uses: actions/setup-node@v5
  with:
    node-version: 22
    cache: npm

- name: Install dependencies
  run: npm ci --no-audit --no-fund
```

The lockfile must be regenerated whenever package.json dependency versions are
changed.
