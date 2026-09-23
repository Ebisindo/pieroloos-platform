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
