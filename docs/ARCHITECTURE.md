# PieroloOS Foundation Architecture

UI → Application Services → Domain/Business Rules → Repository/Data Access → PostgreSQL.

The UI should not contain persistence or core business rules. Evidence and source quality are first-class concepts. Organization and workspace boundaries are modeled from the start. Human decision authority remains separate from automated preparation.

## First vertical slice
Client Intake → Business Profile → Engagement → Jurisdiction Lens → Formation → Compliance → Report → Engagement Record.

## Brand rule
`public/brand/pierolocorp-logo.jpg` is the authoritative supplied logo asset (1536×1536, opaque dark background). Do not redraw or morph the mark. Render it only through `components/brand/BrandLogo.tsx`. Tokens and usage rules are in [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md).

## Public website architecture

- **Public routes:** `/` (for signed-out visitors) and `/partners`. They are listed in `lib/navigation.ts` (`publicRoutes`, `isPublicRoute`). `AppShell` and `BootLayer` bypass the workspace shell and splash for these routes; pages render `components/public/PublicShell.tsx` (header, footer, disclaimer).
- **`/` behaviour:** signed-in users are redirected to their workspace landing page; signed-out visitors see `components/public/PublicHome.tsx`. Public pages read no workspace data.
- **Private by default:** the root layout sets `robots: noindex`. Public pages opt in through `publicPageMetadata()` in `lib/site.ts`. `app/robots.ts` disallows everything except `/` and `/partners`; `app/sitemap.ts` lists only those.
- **Site URL:** `SITE_URL` (optional) enables canonical URLs, sitemap entries and Organization JSON-LD. Unset means they are omitted, not guessed.
- **Fonts:** `next/font/google` (Inter, Space Grotesk) in `app/layout.tsx`; this needs network access at build time.
- **Honesty rule:** public copy distinguishes Available, Foundation and Planned capabilities (`productModules` in `lib/navigation.ts`) and states no partners, customers or approvals.

## Database and service architecture

- PostgreSQL through Prisma 6 (`prisma/schema.prisma`; migrations in `prisma/migrations`, additive, validated by `npm run db:inventory`).
- Tenancy: `Organization` → `Membership(role)` and `Workspace`; domain records carry `organizationId`/`workspaceId`, with composite foreign keys enforcing workspace scope.
- Request path for authenticated APIs: origin check → session → workspace principal and permission → zod validation → service → domain rules → repository → Prisma. See [ARCHITECTURE-LIB.md](ARCHITECTURE-LIB.md).
- Sensitive writes use `authorized-workspace-transaction` and `trusted-action-service`; consequential changes write audit events.
- Documents use S3-compatible private storage with integrity hashes and scan status.
- Background work (notifications, escalations) runs through secret-protected worker routes triggered by `.github/workflows/notification-scheduler.yml`.
- `PartnershipInquiry` is the one intentionally non-tenant-scoped table (public submissions). See [PARTNERSHIP.md](PARTNERSHIP.md).

## Authentication and authorization boundaries

- **Staff:** NextAuth v4 (GitHub or OIDC), JWT sessions. Sign-in requires an existing organization membership (or a client portal grant with a verified email). Roles: owner, admin, advisor, member, viewer; permissions in `lib/auth/roles.ts`; the active workspace comes from the `active-workspace` cookie validated against memberships.
- **Clients:** `ClientPortalGrant` scopes a user to one client with view/upload flags, expiry and revocation (`lib/auth/client-portal-context.ts`).
- **Platform administrators:** `PLATFORM_SUPERADMIN_EMAILS`; does not bypass the membership requirement. Used only for `GET /api/partnerships/inquiries`.
- **Public endpoints:** `POST /api/partnerships/inquiries` (origin check, rate limits, size cap, strict validation) and `/api/health` (no data). Worker routes require `OPERATIONAL_WORKER_SECRET` or the scanner webhook secret.
- There is no `proxy.ts`; every page and route enforces its own checks. A new route needs its own guard and an authorization test.

## Evidence and professional-review boundaries

- Evidence levels E0–E4 (Unknown, User provided, Secondary, Primary, Cross-verified) are defined in `lib/domain/evidence.ts` and mirrored in the database.
- `lib/evidence/policy.ts`: evidence below E3 requires professional review. `lib/domain/trust-boundary.ts` classifies information as **platform guidance** (default) or **source-supported** (E3+ with a verified, in-force source and retrieval date), lists evidence gaps, defines high-risk topics that always escalate, and holds the feature-maturity registry.
- Comparison results flag professional review when evidence is below primary, absent, or explicitly flagged. Unknown stays unknown; it is never scored as zero.
- Platform output is never professional advice. A verified review by platform staff is not recorded as review by a licensed professional; the data model does not capture professional credentials.
- Open gap: the jurisdiction source/rule/obligation registry exists as domain types only.

## Environment variables

Never commit values. Examples live in `.env.example` and `.env.auth.example`.

| Group | Variables | Notes |
| --- | --- | --- |
| Auth | `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GITHUB_ID`, `GITHUB_SECRET`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_PROVIDER_NAME`, `PLATFORM_SUPERADMIN_EMAILS` | `NEXTAUTH_SECRET` is required in production; the build fails without it |
| Database | `DATABASE_URL`, `DATABASE_ENV`, `DATABASE_URL_LOCAL`, `SHADOW_DATABASE_URL_LOCAL` | Shadow database must be disposable |
| Workers | `OPERATIONAL_WORKER_SECRET`, `DOCUMENT_SCANNER_WEBHOOK_SECRET` | Scheduler also needs repository secrets `PIEROLOOS_APP_URL` and `OPERATIONAL_WORKER_SECRET` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_MESSAGE_ID_DOMAIN` | Optional unless notifications are enabled |
| Storage | `OBJECT_STORAGE_BUCKET`, `_REGION`, `_ENDPOINT`, `_ACCESS_KEY_ID`, `_SECRET_ACCESS_KEY`, `_SERVER_SIDE_ENCRYPTION`, `_KMS_KEY_ID` | Private bucket only |
| Public site | `SITE_URL` | Optional; enables canonical URLs, sitemap, JSON-LD |
| Partnerships | `PARTNERSHIP_INQUIRY_NOTIFY_EMAIL` | Optional; content-free alert, needs SMTP |

## Testing commands

```bash
npm run lint
npm run typecheck
npm test                 # no database needed
npm run db:validate && npm run db:inventory
npm run test:db          # needs PostgreSQL (see scripts/run-db-tests.mjs)
NEXTAUTH_SECRET=<value> DATABASE_URL=<url> npm run build
```

CI (`.github/workflows/ci.yml`) provisions PostgreSQL 16 and runs migrate, DB tests, typecheck, tests and build. CI does not run lint, and `test:e2e` has no Playwright configuration.

## Deployment requirements

- Node 22 (as used in CI), PostgreSQL 16+, an S3-compatible private bucket, an SMTP provider if notifications are enabled.
- Run `npm run db:deploy` before starting a new release; migrations are additive.
- Set all required secrets in a secret manager; set `SITE_URL` to the public origin.
- Rate limiting is per-process: inject a shared store or enforce limits at the edge before running more than one instance. `x-forwarded-for` must be set by a trusted proxy.
- Configure the scheduler secrets so notification and escalation workers run.
- Verify security headers on the deployed host. The CSP is minimal (frame, base, form, object only).

## Operational risks

- Per-process rate limiting is bypassable across instances.
- No documented backup, restore rehearsal or recovery runbook.
- No error tracking, structured logging or worker-failure alerting beyond `/api/health`.
- Audit tables have no tamper evidence.
- Unpaginated list queries can grow without bound.
- Fonts download at build time.
- Partnership inquiries contain personal data with no retention or privacy policy yet.
