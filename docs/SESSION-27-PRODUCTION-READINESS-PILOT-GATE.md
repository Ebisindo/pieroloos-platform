# Session 27 — Production Readiness, Pilot Gate and Launch Checklist

This is a launch gate, not a feature session. It is the single readiness record; it replaces the earlier Session 27 tables and the Patch 07 checklist.

**Verdict (2026-10-11): NOT READY for a public or pilot launch.** Code builds and unit tests pass, but most operational controls have no evidence. Blockers are marked **Blocker** and must be closed with evidence.

## How to read this

Statuses: **Passed** (evidence recorded), **Failed** (checked and not met), **Blocked** (cannot proceed until a named dependency exists), **Not tested** (no evidence yet), **Not applicable**. "Implemented" is not "Passed": a control passes only with evidence.

Command evidence was produced on the working tree on 2026-10-11 with dummy `NEXTAUTH_SECRET` and `DATABASE_URL` values:

- `npm run lint`, `npm run typecheck`: exit 0.
- `npm test`: 53 files passed and 1 skipped; 230 tests passed and 7 skipped (mocked database).
- `npm run db:validate`: schema valid. `npm run db:inventory`: 14 migrations validated.
- `npm run db:deploy -- ci` against a disposable PostgreSQL 16 database: all 14 migrations applied; both schema-drift checks report no difference. `npm run test:db`: 7 tests passed.
- `npm run build`: exit 0 with dummy values; fails without `NEXTAUTH_SECRET` by design.
- `playwright.config.ts`, `e2e/a11y.spec.ts`, and `e2e/i18n.spec.ts` are present in the repository; the CI workflow defines a separate Chromium browser-test job. The 2026-10-11 command evidence below is historical and does not establish the current CI result.
- Current browser/accessibility execution result: not independently verified during this documentation update. Automated axe checks are not a WCAG conformance claim; manual keyboard, screen-reader, and visual review remain required.

## Security

| Control | Status | Evidence / gap |
| --- | --- | --- |
| Authorization (route unit tests) | Passed | Per-route tests for engagements, control plane, cross-border, memberships, client portal (`client-portal-routes.test.ts`: unauthenticated, no grant, capability flags, revoked, cross-origin) and partnership inquiries. Mocked database. The portal download route is not yet covered. |
| Tenant isolation against real PostgreSQL | Not tested — **Blocker** | The database integrity suite (`database-integrity.integration.test.ts`: foreign keys, scoped uniqueness, concurrent writes, cascades) passed against real PostgreSQL (7 tests). Route-level cross-tenant read/write cases per route family do not exist; `authorized-workspace-transaction.test.ts`, `workspace-access.test.ts` and `client-portal-access.test.ts` use mocks. |
| Authentication end to end | Not tested | `auth-session.test.ts` passes (mocked). No provider configured in this environment. |
| Secrets controlled | Passed (code) | Auth secret fails fast in production (`resolveAuthSecret`; build failure observed without it). Worker secret via `lib/auth/worker-secret.ts`. No secrets tracked; `.env` is gitignored. Secret manager and rotation runbook: Not tested. |
| Production security headers | Passed (config) / Failed (CSP) | `next.config.ts` sets nosniff, frame deny, referrer, permissions and HSTS. CSP is minimal (frame, base, form, object). Follow-up: nonce-based CSP (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`). Not verified on a deployed host. |
| Rate limiting | Failed — **Blocker** | `lib/http/rate-limit.ts` limits portal reads, uploads and downloads per user, and partnership inquiries per client and globally (429 + Retry-After). The default store is per-process: inject a shared store (Redis) or enforce at the edge before multi-instance deploy. Sign-in and staff APIs are not limited. |
| Input validation (partnership inquiry) | Passed | `tests/partnership-inquiry-route.test.ts`, 19 tests. |
| Input validation (other routes) | Not tested | Existing zod schemas; not reviewed in Patch 06/07. |
| Audit integrity | Failed | Audit tables exist for portal, documents and actions, with no tamper evidence. Decide DB-level append-only (revoke UPDATE/DELETE) or hash chaining before pilot. |
| Penetration test / full security audit | Not tested | Not performed. Passing lint and typecheck is not a security audit. |

## Reliability and operations

| Control | Status | Evidence / gap |
| --- | --- | --- |
| Backup strategy | Failed — **Blocker** | Not documented. Required: managed Postgres PITR, daily snapshot, object-storage versioning for evidence, stated RPO/RTO. |
| Recovery procedure | Failed — **Blocker** | Needs a written runbook and one rehearsed restore into a scratch environment with migration replay (`prisma migrate deploy`) verified. |
| Migration apply and DB integrity tests | Passed (disposable local PostgreSQL 16) | All 14 migrations applied; drift checks clean; `test:db` 7 passed. Found and fixed pre-existing drift: four truncated index names from the client-portal migrations, reconciled by `20261011130000_reconcile_client_portal_index_names`. CI result for this branch: Not tested. Not yet applied to staging or production. |
| Schema and migration structure | Passed | `db:validate` and `db:inventory` (14 migrations). |
| Worker failure handling | Not tested | Worker routes and tests exist (`notification-worker`, `operational-escalation-worker`) and pass; lease/timeout behaviour on crash is unverified. |
| Notification retries | Passed (unit) | Retry and redrive in `notification-worker.ts`, `notification-redrive-route.test.ts`. Dead-letter alerting: Not tested. |
| Observability and monitoring | Failed — **Blocker** | Only `GET /api/health` (DB reachability, no data leaked). Needs structured logs, error tracking, and alerts on worker failure and queue age. |
| Error handling | Failed | No `error.tsx`, `not-found.tsx`, `loading.tsx` or `global-error.tsx` in `app/`. API routes return generic errors (tested for the inquiry route only). |
| Environment variables | Passed (documented) / Blocked (production values) | Documented in `.env.example` and `docs/ARCHITECTURE.md`. Production values need a deployment target and secret manager. |
| Production build | Passed (dummy env) | Not run with real configuration. |
| Deployment | Blocked | No hosting target or deployment configuration in the repository. |

## Quality, testing and documentation

| Control | Status | Evidence / gap |
| --- | --- | --- |
| Unit and route tests | Passed | See command evidence above. |
| End-to-end tests | Configured; latest run not verified | Playwright configuration and public-surface specs exist; CI installs Chromium and runs `npm run test:e2e`. Confirm the latest workflow run and review any failures before changing this to Passed. |
| CI coverage | Configured; latest run not verified | `.github/workflows/ci.yml` includes PostgreSQL migration/integrity checks, lint, typecheck, unit/route tests, production build, and a separate browser-test job. Confirm current workflow results before treating these gates as Passed. |
| Documentation | Passed | README, PRODUCT, ARCHITECTURE, PARTNERSHIP, AUTH-SETUP, DESIGN-SYSTEM updated 2026-10-11; reviewed by the author only. |

## Brand, public site and content

| Control | Status | Evidence / gap |
| --- | --- | --- |
| Branding | Not tested | `BrandLogo`, tokens and public pages exist; no visual review in a browser. |
| Logo assets | Failed | Only an opaque 1536×1536 JPG. No SVG mark, horizontal lockup, favicon set or social image. |
| Public pages | Not tested | `/` and `/partners` build; never viewed in a browser. |
| Public content accuracy | Failed | Funding phase ranges (₦40M–₦65M total) do not reconcile to the stated ₦45M–₦81M programme range. The page discloses this; the owner must correct it. |
| Responsive behaviour | Not tested | Breakpoints written; no device or viewport testing. |
| Accessibility | Partially automated; manual review outstanding | `e2e/a11y.spec.ts` runs axe-core scans on `/` and `/partners` across four locales in CI. A passing automated scan is not proof of WCAG conformance; manual keyboard/screen-reader review, contrast measurement, and a verified current run remain outstanding. |
| SEO (code) | Passed | `tests/seo-metadata.test.ts`; build emits `/robots.txt` and `/sitemap.xml`. |
| SEO (production values) | Blocked | `SITE_URL` unset everywhere; canonical URLs, sitemap and JSON-LD stay off until set. |
| Analytics | Not applicable | None installed. |
| Privacy notice and data retention | Failed | None for stored partnership inquiries or client data. |

## Partnerships and professional review

| Control | Status | Evidence / gap |
| --- | --- | --- |
| Partner inquiry capture | Passed (unit) | Public form, private storage, admin-only list API. Migration not applied anywhere yet. |
| Partner onboarding | Failed | No review UI, accounts, directory or referral workflow. |
| Professional review process | Failed | Software gates exist (`requiresProfessionalReview`, task review gating) but no defined, staffed process, and no capture of professional credentials. |

## Product: must be proven with real data, not tests

All Not tested:

- [ ] Real onboarding of one professional workspace.
- [ ] Real client, with portal grant and published tasks.
- [ ] Real formation workflow end to end.
- [ ] Real compliance workflow with authoritative obligations (the source registry does not exist in the database yet).
- [ ] Real evidence: upload, scan, review.
- [ ] Real report generated.
- [ ] Real professional review recorded.

Product-gap update: client completion submissions, messaging and acknowledgments are now implemented (`client-portal-interactions-routes.test.ts`). No electronic signature capability was found. Decide whether signatures are pilot-required.

## Commercial

| Item | Status |
| --- | --- |
| Plans, entitlements, usage, credits | Prepared: domain, migration and `billing.test.ts` exist (Session 25); no customer UI |
| Payment provider (e.g. Paystack/Stripe) | Failed — **Blocker** (none integrated; consider African-market providers) |
| Invoice | Failed |
| Cancellation, upgrade/downgrade | Failed |
| Usage accounting reconciled against invoices | Failed |

A pilot may run with manual invoicing if entitlements are enforced server-side. State that decision explicitly.

## Implemented versus planned

- **Implemented and tested (unit level):** client intake, formation, compliance, evidence and document workflows, client portal including messaging, notifications, partnership inquiry capture, evidence-driven review flagging, public pages, sitemap and robots.
- **Prepared, not wired:** authoritative source registry, AI explainability records, billing.
- **Planned, absent:** partner programme beyond inquiry capture, risk simulation, automated compliance determination, customer payments.

## Pilot plan

- Scope: 2–3 professional users, 3–5 real companies, one primary jurisdiction (suggest Nigeria or Ghana).
- Pre-conditions: all Blockers closed, migrations replayed on Postgres, restore rehearsed.
- Run: weekly review of workflow breakages, support log, audit sampling, evidence-scan failures.
- Exit criteria: no cross-tenant incident, no lost evidence, restore proven, each professional completes a real workflow, commercial flow decided.
- Rollback: disable portal grants and worker schedules; restore from PITR.

## Highest-priority remaining blockers

1. Backup, restore rehearsal and recovery runbook.
2. Route-level cross-tenant tests against real PostgreSQL, and applying migrations to staging.
3. Shared rate-limit store or edge enforcement, and a fuller CSP.
4. Observability: error tracking, structured logs, worker and queue alerts.
5. Privacy notice and retention policy for stored inquiries and client data.
6. Correct the funding figures before the partnership page is shared.
7. Deployment target, production secrets and `SITE_URL`.
8. Browser verification of branding, responsiveness and accessibility; error, not-found and loading states.
9. A defined professional review process and a way to review partnership inquiries.
10. Logo asset set (SVG, favicon, social image).

## Change history

- Session 27: `next.config.ts` production security headers; `lib/auth/auth-options.ts` fail-fast on missing `NEXTAUTH_SECRET`; `lib/http/rate-limit.ts` and portal routes per-user limiting; `app/api/health/route.ts`; `tests/client-portal-routes.test.ts`, `tests/health-route.test.ts`.
- Patches 01–07 (2026-10-11): brand foundation, public site, partnership page and inquiry workflow, trust boundaries, production-quality review and documentation. See [PARTNERSHIP.md](PARTNERSHIP.md) and [ARCHITECTURE.md](ARCHITECTURE.md).
