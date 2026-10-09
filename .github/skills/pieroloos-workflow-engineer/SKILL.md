---
name: pieroloos-workflow-engineer
description: 'Use when implementing or changing PieroloOS business workflows, lifecycle rules, client intake, formation, compliance, engagement operations, evidence handling, reports, or workflow APIs and UI. Preserve the product boundary, authorization, auditability, and layered architecture.'
---

# PieroloOS Workflow Engineering

Implement PieroloOS business workflows across domain rules, application services, persistence, APIs, and UI without weakening professional-service boundaries or operational trust.

## Workflow

1. Read `AGENTS.md` and the directly relevant product and workflow documents under `docs/`. Consult `docs/ARCHITECTURE.md`, `docs/PRODUCT.md`, and `docs/OPERATIONAL-AUDIT-MODEL.md` when their boundaries apply.
2. Trace the existing behavior from its UI or API entry point through application services, domain rules, and repositories. Identify the layer that owns the decision before editing; keep persistence and core rules out of the UI.
3. Preserve existing public contracts and established patterns. For Next.js APIs or conventions, first read the matching guide under `node_modules/next/dist/docs/` as required by `AGENTS.md`.
4. Make the smallest change at the owning layer. Validate inputs at boundaries, enforce authorization and lifecycle rules server-side, and return explicit failures rather than success-shaped fallbacks.
5. Update focused tests and directly related documentation when a workflow contract or behavior changes. Run the narrowest relevant tests first, then the appropriate typecheck, lint, and database validation.

## Product Invariants

- PieroloOS organizes information, prepares drafts and analyses, tracks workflows and evidence, and supports human review. It does not replace licensed or regulated professionals or government authorities.
- Keep automated preparation distinct from human decisions. A status, signal, health indicator, or operational deadline is not a legal or regulatory conclusion. A signal is an observation, not an obligation; only an explicit, auditable decision should create an action.
- Preserve evidence provenance, quality, confidence, limitations, and review status wherever evidence informs a workflow or report.
- Preserve the distinction between user-provided information, system-derived information, unknowns, and items requiring professional review. Never silently promote an assumption to a fact.
- Scope every read and write to the authenticated organization and workspace using the existing authorization path. An object ID alone does not authorize access.
- Keep responsibilities layered: UI → application services → domain/business rules → repositories/data access. Put lifecycle validation and invalid-transition rejection in the domain layer.
- Make consequential operations auditable. Preserve idempotency for signal-driven action creation and avoid duplicate actions or notifications.
- Use authoritative obligation data for jurisdiction-specific statutory deadlines. Operational escalation thresholds are not substitutes for statutory deadlines.

## Formation Lifecycle

When changing formation behavior, follow `docs/FORMATION-STATE-MACHINE.md` and preserve these rules:

- Plan: `DRAFT → READY → IN_PROGRESS → COMPLETED`; non-terminal states may be cancelled; `BLOCKED` may return to progress.
- Stage: `PENDING → READY → IN_PROGRESS → COMPLETED`; `BLOCKED` may return to progress. `SKIPPED` requires an explicit authorized action.
- Task: `PENDING → READY → IN_PROGRESS → IN_REVIEW → COMPLETED`; `BLOCKED` may return to progress. `WAIVED` requires explicit authorization.
- A task is not `READY` until all required dependencies are `COMPLETED` or `WAIVED`.
- A task requiring evidence cannot be `COMPLETED` until its evidence requirements are satisfied. A task requiring professional review cannot be completed without an approved/reviewed outcome.
- A blocked task must expose a human-readable reason. Do not silently bypass blockers.

## Focused Verification

- Add or adjust tests for permitted and rejected transitions, authorization boundaries, evidence requirements, and duplicate prevention as relevant to the change.
- For schema changes, use the repository's Prisma validation and generation scripts.
- Report the behavior changed, the checks run, and any verification that remains outstanding.