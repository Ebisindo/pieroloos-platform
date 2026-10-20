# Product Boundary

PieroloOS is a professional decision-support and workflow-organization platform. It organizes information, prepares drafts and analyses, tracks workflow and evidence, and supports human review. It does not replace licensed or regulated professionals or government authorities.

## Positioning

- **Name:** PieroloOS — Business Intelligence & Formation Platform.
- **Tagline:** From Business Idea to Business Infrastructure.
- **Public headline:** Build the right business. From idea to infrastructure.
- **Promise:** bring business intent, entity architecture, jurisdiction intelligence, compliance workflows and professional expertise into one structured platform.
- **Vision:** trusted digital infrastructure that makes business formation, corporate structuring, compliance and market expansion more intelligent, accessible and connected across Africa and eventually global emerging markets.
- **Never claim:** guaranteed incorporation or compliance, regulatory approval, customer or partner counts, testimonials, or that the platform replaces legal, tax or financial professionals.

## Journey and current state

Status terms: **Implemented** (code and tests exist), **Partial** (core workflow exists, maturing), **Prepared** (domain logic or types exist, not wired end to end), **Planned** (nothing built).

| Step | Module | Status |
| --- | --- | --- |
| Define business intent | Client intake, business profile | Implemented |
| Entity and market architecture | Business profile, market entry plans | Partial |
| Jurisdiction considerations | Jurisdiction Lens (workspace-recorded observations) | Partial |
| Risk assessment | Market readiness, cross-border dossiers | Partial |
| Formation roadmap | Formation plans, stages, tasks | Partial |
| Compliance organisation | Obligations, evidence, reminders, escalation | Partial |
| Escalation to professionals | Advisor review gates on tasks and evidence | Partial |
| Ongoing administration | Engagements, actions, notifications, reports | Partial |
| Growth and expansion | Market expansion, cross-border preparation | Partial |
| Client collaboration | Client portal (grants, uploads, messages) | Implemented |
| Authoritative jurisdiction source registry | Domain types only; no table, no sourced seed data | Prepared |
| AI output explainability | Domain logic and tests; no model, no persistence | Prepared |
| Billing and entitlements | Schema and domain; no payment provider, no customer UI | Prepared |
| Partner inquiry capture | Public form, private storage, admin API | Implemented |
| Partner onboarding, directory, referrals | None | Planned |
| Risk simulation, automated compliance determination | None | Planned |

The feature-maturity registry in `lib/domain/trust-boundary.ts` mirrors this table for the evidence-sensitive features and is covered by tests.

## Current limitations

- No jurisdiction rule is presented as authoritative: seed jurisdiction records contain structure only. Real claims must enter through evidence workflows.
- Statutory deadlines need authoritative obligation data that does not yet exist in the database.
- There is no UI to review partnership inquiries; the admin list is an API only.
- No payment provider, invoicing or cancellation flow.
- Search in the application shell is a placeholder.
- Many list queries are unpaginated.
- No end-to-end browser tests.

## Roadmap (sequenced; not committed dates)

1. Close the pilot-gate blockers: shared rate-limit store, backup and restore rehearsal, observability, cross-tenant tests against real PostgreSQL.
2. Authoritative jurisdiction source and obligation registry with provenance (Session 23 scope).
3. Partner programme: admin review of inquiries, partner identity and scoped access, referral workflow with audit trail.
4. Customer billing integration and entitlements enforcement.
5. Pagination and search across workspace lists.
6. AI-assisted analysis only after the explainability layer is persisted and review-gated.
