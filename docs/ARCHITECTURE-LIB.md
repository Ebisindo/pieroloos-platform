# PieroloOS — Session 02 Library Architecture

## Purpose

Session 02 establishes the application/domain boundary beneath the UI. It adds repositories, services, validation, evidence policy, authorization primitives and expanded relational models.

## Request path

```text
Route / Server Action / API
        ↓
Authentication
        ↓
Workspace + Permission check
        ↓
Zod validation
        ↓
Application service
        ↓
Domain rules
        ↓
Repository
        ↓
Prisma
        ↓
PostgreSQL
```

## Rules

1. React components do not call Prisma directly.
2. Untrusted input is validated before reaching repositories.
3. Workspace-scoped records must be authorized before mutation.
4. Evidence is treated as a first-class data concern.
5. Analytical indicators are not professional conclusions.
6. Human decision authority remains outside automated domain rules.
7. Provider-specific authentication can be added later without rewriting domain services.

## Added domains

- Clients and intake
- Business profiles
- Engagements
- Evidence and sources
- Jurisdiction observations
- Formation roadmaps
- Compliance
- Reports
- Documents
- Audit events
