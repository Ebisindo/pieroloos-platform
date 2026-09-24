# Session 04 — Client Intake & Business Profile Engine

## Workflow

Client
→ Intake Draft
→ Validation
→ Classification
→ Client Record
→ Business Profile
→ Engagement
→ Activity Event

## Design principle

The intake is not a generic form. It is a controlled information-capture process.

Every captured item should eventually be distinguishable as:
- FACT
- ASSUMPTION
- UNRESOLVED

The system preserves user-provided information and does not silently convert assumptions into facts.

## Authority boundary

PieroloOS prepares and organizes information. It does not make legal, tax, regulatory, banking, or other regulated professional decisions on behalf of users.

## API

POST `/api/clients/intake`
- creates a client, business profile, and optional engagement from a validated intake payload.

GET `/api/clients/[id]`
- returns the client and related profile/engagement data.

PATCH `/api/clients/[id]`
- updates controlled client/profile fields.

## Future expansion
- autosave drafts
- intake versioning
- evidence attachment
- source references
- completeness scoring
- workflow approvals
- client portal intake
