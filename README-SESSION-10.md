# PieroloOS — Session 10
## Evidence & Document Intelligence

This is an additive package for the existing PieroloOS Sessions 01–09 repository.

### Included
- persistent document domain model
- evidence-quality model
- SHA-256 integrity utilities
- evidence intelligence engine
- document storage service boundary
- repository interfaces
- validation schemas
- upload validation boundary
- document audit model
- document API boundaries
- review API boundary
- evidence intelligence API
- EvidenceBadge
- DocumentEvidencePanel
- Prisma additions
- automated tests
- architecture documentation

### Installation

```bash
git checkout -b feature/evidence-document-intelligence
```

Merge `prisma/session-10-evidence-document.prisma` into the existing `prisma/schema.prisma`.

Then:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx prisma migrate dev --name evidence-document-intelligence
npm test
```

Then:

```bash
git add .
git commit -m "feat: add evidence and document intelligence"
git push -u origin feature/evidence-document-intelligence
```

### Important

The API routes intentionally stop at integration boundaries. Before production, connect them to the authenticated organization/workspace authorization layer, PostgreSQL repositories, object storage, audit service and background processing.

Do not expose arbitrary object-storage keys or implement unrestricted document downloads.
