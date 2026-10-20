# PieroloOS `lib/` foundation

This directory contains the initial application logic foundation for PieroloOS.

Copy the `lib/` directory into the root of the `pieroloos-platform` repository.

Structure:

```text
lib/
├── auth/
│   └── roles.ts
├── db/
│   ├── client-repository.ts
│   └── prisma.ts
├── evidence/
│   └── types.ts
├── services/
│   └── client-service.ts
├── utils/
│   └── cn.ts
└── validation/
    └── client.ts
```

The code is intentionally limited to foundation-level concerns. Authentication, full business workflows, evidence persistence, and additional repositories will be implemented incrementally in later sessions.

# PieroloOS lib/

The `lib` layer contains reusable application infrastructure and domain logic.

## Boundaries

- `auth/` — authentication context and authorization primitives. Provider-specific integration is intentionally abstracted.
- `db/` — Prisma client and repository/data-access functions. UI components should not query Prisma directly.
- `domain/` — business concepts and deterministic rules that should remain framework-independent.
- `evidence/` — evidence classes, policy and source-aware analysis primitives.
- `services/` — application use cases coordinating validation, repositories and domain rules.
- `validation/` — Zod schemas for untrusted input.
- `utils/` — small framework-agnostic helpers.

## Request flow

UI/API → validation → service → domain rules → repository → Prisma/PostgreSQL

Authentication and authorization must be applied before workspace-scoped mutations.
