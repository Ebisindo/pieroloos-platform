# Policy Framework Audit and Release Checklist

Audit date: 14 October 2026
Repository: Ebisindo/pieroloos-platform
Audit approach: Read-only repository review before implementation. This is repository evidence, not a legal compliance opinion or production-environment audit.

## Stage 1 — Repository findings

### Architecture and routes
- The repository uses Next.js App Router, TypeScript, a root layout that defaults to noindex, components/public/PublicShell.tsx, typed locale catalogues and lib/navigation.ts for signed-out route classification.
- Before this feature branch, the documented public routes were / and /partners. Public pages should avoid workspace data access, and each new public route needs classification tests.
- lib/site.ts obtains canonical origin from SITE_URL; an unset or invalid value should never result in an invented origin.
- Existing SEO controls use INDEXABLE_PATHS, app/robots.ts and app/sitemap.ts. Public reachability and search indexing must be governed separately.

### Product and capability boundaries
- docs/PRODUCT.md describes PieroloOS as decision-support and workflow-organisation software, not a substitute for qualified professionals or authorities.
- The product documentation states jurisdiction rules are not authoritative by default and seeded jurisdiction records are structural only; the source registry is prepared, not an authoritative populated database.
- Billing and entitlements are prepared at the domain/schema level. The product documentation says no payment provider, customer-facing billing UI or cancellation flow is operational.
- Partnership inquiry capture exists, but partner onboarding/directory/referrals are planned. An inquiry must not be represented as an executed partnership.
- AI explainability is a prepared foundation; a live AI model and persistence flow are not wired end-to-end according to product documentation.

### Data, privacy and administration
- The application uses Prisma/PostgreSQL and models organization/workspace membership, client portal grants, private document storage and platform-admin permissions. Repository docs describe server-side access checks and audit events for sensitive writes.
- Source review alone does not establish production data flows, processors/subprocessors, cookie inventory, retention periods, deletion behaviour, international transfer locations, production backup/restore readiness or operational incident response. These require configuration and operational evidence before final privacy/security statements can be approved.
- Existing platform administration uses database-backed Super Admin control plus explicit permissions. No versioned policy approval/publication workflow was found in the scoped audit. This branch adds a static policy directory and drafts, not a database-backed legal CMS or proof of approval.
- No policy-acceptance checkbox or record is introduced in this scope. A link is not consent and this branch does not claim to record legal acceptance.

### Internationalisation
- English is the source/default locale. French, Portuguese and Spanish are preview catalogues, and the existing preview notice says content may remain in English and translations have not been professionally reviewed.
- FAQ/Terms pages use locale catalogues for metadata and key page notices, while detailed legal and FAQ body text remains in English. The preview disclosure is retained; these pages must not imply that non-English legal copy is reviewed.

### Verification constraints
- package.json defines npm run lint, npm run typecheck, npm test, npm run db:validate, npm run db:inventory and npm run build. The readiness record says there is no working Playwright E2E suite yet.
- The GitHub connector can read/write repository files but cannot execute npm commands in this session. Test outcomes must be reported as not run unless verifiable CI evidence is available.
- AGENTS.md requires the matching framework guides in node_modules/next/dist/docs/ before framework-level edits. The connector cannot inspect installed local node_modules; the implemented route metadata follows the current App Router async params shape also documented in the public Next.js reference.

## Implementation sequence and dependencies
1. Public route foundation: explicit route allowlist, PublicShell footer links, metadata and SITE_URL-derived canonicals.
2. FAQ: source-authored Q&A, semantic details/summary disclosures, Terms/policies links, and FAQ structured data derived from the same Q&A data that is rendered.
3. Terms: prominent legal-review blocker and core contractual topics without inventing legal identity, dates, governing law, pricing, liability caps, contact details or service guarantees.
4. Policy directory and drafts: /policies plus pages for the requested policy categories. Use stable IDs, version labels, explicit draft status and policy-specific unresolved requirements. This is a static registry, not an approval-enforced policy management system.
5. Indexing control: index FAQ among newly introduced routes. Keep Terms and all policy draft routes out of the sitemap and search indexing until approval.
6. Internationalisation and access: maintain typed catalogues and route-level tests while keeping the preview/fallback status disclosed.
7. Quality assurance: check route classification, metadata, sitemap/robots, FAQ schema/content parity, draft gates and locale catalogue parity; run project scripts in a repository checkout or CI.
8. Governance follow-up: consider a database-backed policy lifecycle as a separately scoped change after reviewing existing permissions, audit patterns, data flows and migration constraints.
9. Release: open a reviewable pull request only; do not merge or deploy automatically.

## Internal legal and operational publication checklist
This section is internal implementation guidance, not binding public policy text.
- [ ] Confirm operating legal entity, registered address and official contacts.
- [ ] Obtain qualified legal review for the actual operator, intended markets and user types.
- [ ] Review governing law, disputes, liability, indemnity, consumer rights and complaint handling.
- [ ] Verify data flows, controller/processor roles, subprocessors, privacy disclosures, retention, deletion, cookies, transfer locations and user rights.
- [ ] Verify billing, payment provider, prices, currency, taxes, renewals, cancellations, refunds and entitlements before offering paid features.
- [ ] Verify production security controls, incident response and backup/restore processes before making operational promises.
- [ ] Establish policy IDs, approved version history, reviewer identities, effective dates and user-acceptance evidence where legally required.
- [ ] Review French, Portuguese and Spanish translations linguistically and legally before activating any translated legal version.
- [ ] Confirm content owners, review cadence, and who may approve/publish policies.
- [ ] Run and record required lint, typecheck, unit, database and build checks.
- [ ] Obtain product-owner and required legal approval; close blockers before removing draft/noindex notices.

## Status
The audit found no existing FAQ, Terms, Privacy or policy routes in the current public website documentation. New public pages in this branch remain deliberately marked as drafts/notices. Binding legal publication is not ready until the checklist and operational blockers are resolved.
