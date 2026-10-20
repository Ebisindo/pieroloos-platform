# Business-intent proposal contract

This document describes the first validation-only slice for Issue #24. It defines a strict structured contract for an AI/provider-produced business-intent proposal; it does not connect an AI provider, save proposals to PostgreSQL, or expose an API.

## Contract

`lib/validation/business-intent-proposal.ts` defines a Zod schema for:
- A business summary, explicit assumptions and missing facts.
- A complexity classification with rationale and contributing factors; `UNDETERMINED` is valid and no numeric score is implied.
- Jurisdiction comparison criteria and their rationale, not a legal conclusion or jurisdiction ranking.
- Proposed graph nodes and edges, with unique IDs, valid endpoints, no self-links and ownership percentages only on ownership relationships.
- Risk scenarios with explicit unknown likelihood/impact options and rationale.
- Evidence gaps with a minimum evidence class and professional-review flag.
- Evidence references. Retrieved sources require a URL and retrieval timestamp; user-provided material is identified separately.
- A mandatory `PROPOSED` review state. The schema cannot approve or promote a proposal.

Strict object schemas reject unrecognized fields, and array/field limits bound payload size. These checks are structural safeguards, not proof that a provider's claims are true.

## Required controls before provider integration

1. Treat all user text, uploaded documents and retrieved page contents as untrusted data, never as executable instructions.
2. Keep provider credentials server-side; never expose secrets to the browser or include them in logs.
3. Add provider abstraction, timeouts, rate limits, entitlement checks, bounded input/output sizes and sanitized failure responses.
4. Persist immutable proposal snapshots with creator, workspace/client, model/provider version, timestamp, input digest where appropriate, evidence references and review state.
5. Validate the schema and graph semantics before displaying or saving any provider output. Reuse the production corporate-graph domain validator before promotion.
6. Do not claim source support unless the source was actually provided or retrieved. Never fabricate legal rules, taxes, fees, filing deadlines, banking access or jurisdiction-specific legal interpretations.
7. Require authorized advisor review to approve, reject or request changes. Only the explicit approval workflow may promote a proposal into an operational graph or formation workflow.
8. Make the UI and exports state that proposals are preliminary decision support, not legal, tax, banking or compliance advice.

## Out of scope for this slice

- AI provider integration or prompt orchestration.
- Persistent proposal/review models and API routes.
- Retrieval/indexing of authoritative sources.
- Risk simulation engine or automatic jurisdiction scoring.
- Advisor approval UI and promotion workflow.
- Incorporation, filing or authoritative compliance decisions.

CI and code review must pass before this slice is considered verified. Do not add real credentials or seed fictional jurisdictional facts.
