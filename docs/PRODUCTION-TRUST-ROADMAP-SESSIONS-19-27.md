# Production Trust Roadmap — Sessions 19–27

This roadmap defines the next controlled development programme after [Session 18 — Cross-border transaction preparation dossiers](./SESSION-18-CROSS-BORDER-DOSSIERS.md). Its purpose is to make the existing architecture trustworthy in a real production environment, not to accumulate unrelated features.

## Governing sequence

```text
18  Cross-border Dossiers
 ↓
19  Production Data & Migration Integrity
 ↓
20  Identity, Tenant Isolation & Authorization Hardening
 ↓
21  Durable Documents & Evidence Storage
 ↓
22  Notification & Background Job Infrastructure
 ↓
23  Authoritative Jurisdiction / Obligation Intelligence
 ↓
24  AI Intelligence & Explainability Layer
 ↓
25  Billing, Entitlements & Monetization
 ↓
26  Client Portal & External Collaboration
 ↓
27  Production Readiness + Pilot Launch
```

Sessions are intentionally ordered: each session establishes capabilities and controls needed by the next. Do not treat later sessions as independent feature work or begin them in parallel with unresolved prerequisites. If evidence shows the sequence needs to change, document the reason and its production-risk impact before changing it.

## Session objectives and exit gates

### 19 — Production Data & Migration Integrity

Establish confidence that production data can be deployed, evolved, backed up, restored, and reconciled safely.

Implementation phases and current verification status are tracked in [Session 19 — Production Data Integrity & Migration Control](./SESSION-19-PRODUCTION-DATA-INTEGRITY.md).

**Exit gate:** A repeatable production migration and recovery process is documented and verified; migrations are reviewed for data safety and consistency; backup and restore have been exercised against a representative environment; schema and migration state are reconciled.

### 20 — Identity, Tenant Isolation & Authorization Hardening

Prove that identity, workspace membership, tenant boundaries, and role-based permissions are enforced consistently across UI, APIs, background work, and data access.

Implementation status, controls, and outstanding verification are tracked in [Session 20 — Identity, Tenant Isolation & Authorization Hardening](./SESSION-20-IDENTITY-TENANT-AUTHORIZATION.md).

**Exit gate:** Cross-tenant access and unauthorized operations are covered by negative tests; every sensitive operation has an explicit authorization policy; identity/session and privileged-access behavior is documented and verified.

### 21 — Durable Documents & Evidence Storage

Move documents and evidence onto durable, access-controlled storage with lifecycle, integrity, and recovery controls suitable for production.

**Exit gate:** Upload, retrieval, authorization, integrity verification, retention/deletion, and recovery behavior are tested; evidence references remain correctly scoped; storage credentials and access are managed outside application source.

### 22 — Notification & Background Job Infrastructure

Make notifications and asynchronous work durable, observable, retryable, and safe under duplicate delivery or worker interruption.

**Exit gate:** Jobs have persistence, idempotency, bounded retries, failure visibility, and operational controls; notification delivery outcomes can be inspected; worker failure and recovery are tested.

### 23 — Authoritative Jurisdiction / Obligation Intelligence

Establish governed jurisdiction and obligation data with source provenance, effective dates, review ownership, and update processes before presenting it as operational guidance.

**Exit gate:** Each published item has traceable authoritative sources, jurisdiction and effective-date context, review status, and a defined update/withdrawal path; product language distinguishes sourced information from professional advice or determinations.

### 24 — AI Intelligence & Explainability Layer

Add AI only over governed data and workflows, with traceable source grounding, clear limits, human review, and controls for uncertain or unsafe outputs.

**Exit gate:** AI outputs are attributable to retrieved sources and their versions; uncertainty and limitations are visible; consequential decisions remain reviewable by authorized humans; evaluations cover quality, failure modes, and regressions.

### 25 — Billing, Entitlements & Monetization

Introduce commercial plans and billing only after the underlying access, data, and operational boundaries are trustworthy.

**Exit gate:** Entitlements are enforced server-side; billing state changes are authenticated, idempotent, and auditable; plan changes, failures, cancellation, and access reconciliation are tested.

### 26 — Client Portal & External Collaboration

Enable carefully bounded collaboration with clients and external participants without weakening workspace isolation or evidence controls.

**Exit gate:** External identities receive only explicitly granted, revocable access; portal actions are authorized and auditable; sharing, invitation, removal, and evidence-access boundaries have negative tests.

### 27 — Production Readiness + Pilot Launch

Validate the complete production operating model with a deliberately bounded pilot, including security, support, observability, incident response, recovery, and launch criteria.

**Exit gate:** Pilot scope and success/stop criteria are approved; production configuration and runbooks are verified; monitoring, incident response, backup recovery, support ownership, and rollback have been exercised; known risks and residual limitations are accepted by accountable owners.

## Programme rule

Each session should leave behind verifiable evidence for its exit gate, not just implementation. Record unresolved risks, operational ownership, and any deliberate limitations before advancing. Session 27 is the launch decision point, not an assumption that completion of the preceding feature work automatically makes the platform production-ready.
