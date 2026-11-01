# PieroloOS Foundation Architecture

UI → Application Services → Domain/Business Rules → Repository/Data Access → PostgreSQL.

The UI should not contain persistence or core business rules. Evidence and source quality are first-class concepts. Organization and workspace boundaries are modeled from the start. Human decision authority remains separate from automated preparation.

The dedicated Business Profile workspace at `/business-profile` reads and edits the profile created during client intake; it does not create a second profile record. Reports use workspace-scoped snapshots saved as report documents, while engagement operations use the existing status-transition graph and audit activity trail.

## First vertical slice
Client Intake → Business Profile → Engagement → Jurisdiction Lens → Formation → Compliance → Report → Engagement Record.

## Brand rule
`public/brand/pierolocorp-logo.jpg` is the authoritative supplied logo asset (1536×1536, opaque dark background). Do not redraw or morph the mark. Render it only through `components/brand/BrandLogo.tsx`. Tokens and usage rules are in [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md).

## Public website architecture

- **Public routes:** `/`, `/partners`, `/faq`, `/terms`, `/policies`, and explicitly allowlisted `/policies/{slug}` document routes. They are listed in `lib/navigation.ts` (`publicRoutes`, `isPublicRoute`). `AppShell` and `BootLayer` bypass the workspace shell and splash for these routes; pages render `components/public/PublicShell.tsx`. Signed-out public documents must not read workspace records.
- **`/` behaviour:** signed-in users are redirected to their workspace landing page; signed-out visitors see `components/public/PublicHome.tsx`.
- **Indexing is narrower than public access:** the root layout defaults to `noindex`; `INDEXABLE_PATHS`, `app/robots.ts`, and `app/sitemap.ts` control search discovery. FAQ is indexable. Draft Terms and policy pages remain excluded from indexing and the sitemap until approval. The Terms and policy routes remain crawlable so crawlers can read their `noindex` metadata. `SITE_URL` is never guessed.
- **Site URL:** `SITE_URL` (optional) enables canonical URLs, sitemap entries and Organization JSON-LD. Unset means they are omitted, not guessed.
- **Fonts:** `next/font/google` (Inter, Space Grotesk) in `app/layout.tsx`; this needs network access at build time.
- **Honesty rule:** public copy distinguishes Available, Foundation and Planned capabilities (`productModules` in `lib/navigation.ts`) and states no partners, customers or approvals.
- **Internationalization:** `lib/i18n/` contains the default English locale, proposed locale registry, typed catalogs, fallback and formatting helpers. Public and the new Business Profile, Reports and Engagements workflows use the locale catalogs. Other authenticated workflows may still have untranslated portions. See [INTERNATIONALIZATION.md](INTERNATIONALIZATION.md).

## Database and service architecture

- PostgreSQL through Prisma 6 (`prisma/schema.prisma`; migrations in `prisma/migrations`, additive, validated by `npm run db:inventory`).
- Tenancy: `Organization` → `Membership(role)` and `Workspace`; domain records carry `organizationId`/`workspaceId`, with composite foreign keys enforcing workspace scope.
- Request path for authenticated APIs: origin check → session → workspace principal and permission → zod validation → service → domain rules → repository → Prisma. See [ARCHITECTURE-LIB.md](ARCHITECTURE-LIB.md).
- Sensitive writes use `authorized-workspace-transaction` and `trusted-action-service`; consequential changes write audit events.
- AI business-intent proposals are advisory snapshots. Human review is version-bound; separate operation-bound execution consent is recorded in `AIExecutionAuthorization`. No external executor is connected to this ledger yet; see [AI execution authority](AI-EXECUTION-AUTHORITY.md).
- Documents use S3-compatible private storage with integrity hashes and scan status.
- Background work (notifications, escalations) runs through secret-protected worker routes triggered by `.github/workflows/notification-scheduler.yml`.
- `PartnershipInquiry` is the one intentionally non-tenant-scoped table (public submissions). See [PARTNERSHIP.md](PARTNERSHIP.md).

## Authentication and authorization boundaries

- **Staff:** NextAuth v4 (GitHub or OIDC), JWT sessions. Sign-in requires an existing organization membership (or a client portal grant with a verified email). Roles: owner, admin, advisor, member, viewer; permissions in `lib/auth/roles.ts`; the active workspace comes from the `active-workspace` cookie validated against memberships.
- **Clients:** `ClientPortalGrant` scopes a user to one client with view/upload flags, expiry and revocation (`lib/auth/client-portal-context.ts`).
- **Platform administrators:** the database-backed `PlatformSuperAdmin` singleton and explicit `PlatformAdministratorPermission` assignments, independent of workspace roles and still requiring existing staff membership. See [ADMINISTRATION.md](ADMINISTRATION.md).
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
| Auth | `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `GITHUB_ID`, `GITHUB_SECRET`, `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, `OIDC_PROVIDER_NAME` | `NEXTAUTH_SECRET` is required in production; the build fails without it |
| Database | `DATABASE_URL`, `DATABASE_ENV`, `DATABASE_URL_LOCAL`, `SHADOW_DATABASE_URL_LOCAL` | Shadow database must be disposable |
| Workers | `OPERATIONAL_WORKER_SECRET`, `DOCUMENT_SCANNER_WEBHOOK_SECRET` | Scheduler also needs repository secrets `PIEROLOOS_APP_URL` and `OPERATIONAL_WORKER_SECRET` |
| Email | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM`, `SMTP_MESSAGE_ID_DOMAIN` | Optional unless notifications are enabled |
| Storage | `OBJECT_STORAGE_BUCKET`, `_REGION`, `_ENDPOINT`, `_ACCESS_KEY_ID`, `_SECRET_ACCESS_KEY`, `_SERVER_SIDE_ENCRYPTION`, `_KMS_KEY_ID` | Private bucket only |
| Rate limiting | `RATE_LIMIT_REDIS_REST_URL`, `RATE_LIMIT_REDIS_REST_TOKEN` | Required together in production; atomic shared Redis REST counters; no in-memory production fallback |
| Public site | `SITE_URL` | Optional; enables canonical URLs, sitemap, JSON-LD |
| Partnerships | `PARTNERSHIP_INQUIRY_NOTIFY_EMAIL` | Optional; content-free alert, needs SMTP |
| Payments | `PAYMENTS_ENABLED`, `STRIPE_PAYMENTS_ENABLED`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BANK_TRANSFER_ENABLED`, `BANK_TRANSFER_DETAILS_VERIFIED`, `CRYPTO_PAYMENTS_ENABLED`, per-rail crypto variables | All payment flags default to false. Secret/configure account and token/network values in deployment secret management. Review `PAYMENTS-IMPLEMENTATION-STATUS.md`; there is no automatic blockchain verifier in the current implementation. |

## Testing commands

```bash
npm run lint
npm run typecheck
npm test                 # no database needed
npm run db:validate && npm run db:inventory
npm run test:db          # needs PostgreSQL (see scripts/run-db-tests.mjs)
NEXTAUTH_SECRET=<value> DATABASE_URL=<url> npm run build
```

CI (`.github/workflows/ci.yml`) has separate quality and browser-test jobs. The quality job provisions PostgreSQL 16, validates and applies migrations to a disposable CI database, runs database-integrity tests, lint, typecheck, unit/route tests, and a production build. The browser job installs Chromium, builds the app, and runs the Playwright suite against the production server; current public-surface coverage includes accessibility scans and internationalization/responsive checks. These automated checks do not replace manual keyboard, screen-reader, visual, security, or production-environment verification.

## Deployment requirements

- Node 22 (as used in CI), PostgreSQL 16+, an S3-compatible private bucket, an SMTP provider if notifications are enabled.
- Run `npm run db:deploy` before starting a new release; migrations are additive.
- Set all required secrets in a secret manager; set `SITE_URL` to the public origin.
- Configure `RATE_LIMIT_REDIS_REST_URL` and `RATE_LIMIT_REDIS_REST_TOKEN` in production. Rate-limit requests use atomic Redis Lua counters and fail closed when the shared store is unavailable; validate provider quotas and alerting in staging before rollout.
- Trust forwarded client-IP headers only when set by the configured trusted proxy/CDN; never accept arbitrary caller-supplied forwarding headers as identity.
- Configure the scheduler secrets so notification and escalation workers run.
- Verify security headers on the deployed host. The CSP is minimal (frame, base, form, object only).

## Observability

- `lib/observability/logger.ts` emits a narrow, allow-listed JSON event schema; it must not receive arbitrary request data or exception objects.
- `GET /api/health` checks PostgreSQL reachability, returns a server-generated correlation ID, and logs generic dependency status without raw errors.
- The health endpoint is not proof of object-storage, worker, alert-delivery, backup, or full service readiness. See [Observability and Operations](OBSERVABILITY-OPERATIONS.md) for current scope and release evidence requirements.

## Operational risks

- Rate-limit policies still need a route-by-route inventory and staging verification of limits, failure behavior, shared-store availability and trusted-proxy configuration.
- A recovery runbook is documented, but no successful isolated backup/restore rehearsal evidence or measured recovery objectives are recorded.
- Structured operational logging is initially integrated only with `/api/health`; broader route/worker instrumentation and tested alert delivery remain open (see [Observability and Operations](OBSERVABILITY-OPERATIONS.md)).
- Audit tables have no tamper evidence.
- Unpaginated list queries can grow without bound.
- Fonts download at build time.
- Partnership inquiries contain personal data with no retention or privacy policy yet.


## FAQ, Terms and policy document routes

The public route allowlist now includes `/faq`, `/terms`, `/policies`, and the explicit policy slugs in `lib/navigation.ts`. These pages use `components/public/PublicShell.tsx` and must not read workspace records for signed-out visitors. Public accessibility does not imply permission to index a page: the FAQ is in `INDEXABLE_PATHS`, while the Terms page and the Policies directory/document routes remain `noindex` until their publication blockers are resolved. `SITE_URL` is never guessed; it supplies canonical URLs and sitemap origin only when configured. All Terms and policy pages remain conspicuously marked as drafts, and public policy drafts are not a substitute for a versioned, approval-enforced policy-management workflow.
