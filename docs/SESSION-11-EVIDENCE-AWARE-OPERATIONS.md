# PieroloOS — Session 11
## Evidence-Aware Command Center & Operational Intelligence

Session 11 connects Session 10's persistent evidence layer to the operational control plane.

Architecture:

Evidence → Evidence Intelligence → Operational Signals → Compliance Control Center → Command Center → Audit → Reports

Signals:
- EVIDENCE_GAP
- REVIEW_REQUIRED
- INTEGRITY_CONFLICT
- SUPERSEDED_EVIDENCE
- COMPLIANCE_RISK

Severity:
- INFO
- ATTENTION
- CRITICAL

Command Center health:
- OPERATIONAL
- ATTENTION
- DEGRADED

A DEGRADED state means critical control signals exist and should be investigated. It is not an independent legal or regulatory conclusion.

Workspace authorization supports:
- documents:read
- documents:write
- documents:review
- compliance:read
- compliance:write
- reports:read
- reports:write
- audit:read

Object storage is abstracted through ObjectStorageAdapter. Production document downloads must use trusted storage metadata and authorization, never user-supplied storage keys.

Evidence can enter reports with status, confidence, evidence class, verified document versions, hashes and limitations.

Next transition: Session 12 should consolidate the operational control plane into a unified Command Center, introduce task/action assignment, evidence escalation workflows, controlled report generation, and stronger organization/workspace authorization with real repositories.
