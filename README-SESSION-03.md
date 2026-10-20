# PieroloOS — Session 03 Package

This package advances the project from domain foundation to the first real operating environment.

## Merge

Merge the contents into the root of your existing `pieroloos-platform` project.

Primary additions:
- `app/`
- `components/`
- `lib/navigation.ts`
- `docs/SESSION-03.md`
- `docs/DESIGN-SYSTEM.md`

The package intentionally does not replace the Session 02 domain/repository layer.

## Verification

From the project root:

```bash
npm install
npx prisma generate
npm run typecheck
npm run dev
```

Open `/command-center`.

The root `/` redirects to the Command Center.

## Expected experience

Boot layer → application shell → responsive workspace → Command Center → module routes.

No production authentication is enabled yet. The shell is prepared for the authentication boundary to be introduced in a later session.
