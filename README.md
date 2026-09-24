# PieroloOS package-lock correction

This package deliberately does NOT contain a fake package-lock.json.

The repository currently has no lockfile, and the package manifest resolves
multiple dependencies from `latest`. npm must perform the real dependency
resolution to produce the integrity and transitive dependency metadata needed
for `npm ci`.

See `package-lock-generation-instructions.txt`.
