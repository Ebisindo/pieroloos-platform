# Session 24 — AI Intelligence & Explainability

## Product boundary

AI is a preparation and explanation layer over governed PieroloOS records. It does not replace those records, establish legal or regulatory obligations, or make professional decisions. Any generated material claim must point to disclosed structured data references; user-provided information, verified evidence, authoritative sources, derived records, and unknowns remain distinct.

## Provider-neutral explainability foundation

`lib/domain/ai-explainability.ts` defines the shared output contract for the planned capabilities:

- client-intake interpretation and business-structure suggestions
- jurisdiction comparison and compliance summaries
- evidence-gap explanations and risk identification
- report drafts, meeting/task summaries, cross-border dossier preparation, and professional handoffs

An output identifies its task, generation time, text, material claims and their cited reference IDs, the exact data records and source/version metadata used, assumptions and their impact, limitations, evidence retrieval/effective-date context, and human-review state. Every output is pending human review during this initial rollout. Additional review reasons are recorded when claims are unsupported, source quality/status is not verified, sources are superseded or not yet effective, retrieval dates are missing, assumptions are present, or a model requests review. Material claims with no citation and citations outside the disclosed data set fail validation; invalid citations block approval.

The domain can record a reviewer, decision time, and rationale for an approved or changes-requested outcome. Authentication, role authorization, persistence, append-only audit events, and UI/API review actions must be enforced by later application/service/repository work; this pure domain function is not an authorization boundary.

## Deliberate limits of this increment

- No model provider, prompt pipeline, vector store, or external AI call is selected or enabled.
- No universal evidence-staleness threshold is imposed. The contract exposes retrieval dates and flags missing dates; task/jurisdiction update policies need their own reviewed rules.
- The explainability record is not yet persisted. Until persistence and authorization are implemented, this contract alone does not make an AI output auditable in production.
- Outputs remain decision support, not legal, tax, regulatory, banking, licensing, or other professional advice or determinations.

## Remaining exit work

Select and configure a model provider; build evidence-scoped retrieval with workspace authorization; persist immutable output, input-reference/version, and review-decision records; wire capabilities to application services and UI; add redaction, retention, and failure handling; and evaluate citation fidelity, unsupported-claim behavior, freshness, privacy, and regression quality before enabling any consequential workflow.
