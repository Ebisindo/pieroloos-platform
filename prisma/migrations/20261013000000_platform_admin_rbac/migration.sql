CREATE TYPE "PlatformPermission" AS ENUM (
  'DASHBOARD_READ',
  'CLIENTS_READ',
  'PARTNERSHIP_INQUIRIES_READ',
  'ADMINS_READ',
  'AUDIT_READ'
);

CREATE TABLE "PlatformAdministrator" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAdministrator_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformSuperAdmin" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "userId" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformSuperAdmin_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlatformSuperAdmin_singleton_check" CHECK ("id" = 'singleton')
);

CREATE TABLE "PlatformAdministratorPermission" (
  "id" TEXT NOT NULL,
  "administratorId" TEXT NOT NULL,
  "permission" "PlatformPermission" NOT NULL,
  "grantedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAdministratorPermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PlatformAuditEvent" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorRole" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "subjectType" TEXT,
  "subjectId" TEXT,
  "outcome" TEXT NOT NULL,
  "reason" TEXT,
  "details" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformAdministrator_userId_key" ON "PlatformAdministrator"("userId");
CREATE INDEX "PlatformAdministrator_createdAt_idx" ON "PlatformAdministrator"("createdAt");
CREATE UNIQUE INDEX "PlatformSuperAdmin_userId_key" ON "PlatformSuperAdmin"("userId");
CREATE UNIQUE INDEX "PlatformAdministratorPermission_administratorId_permission_key"
  ON "PlatformAdministratorPermission"("administratorId", "permission");
CREATE INDEX "PlatformAdministratorPermission_grantedByUserId_createdAt_idx"
  ON "PlatformAdministratorPermission"("grantedByUserId", "createdAt");
CREATE INDEX "PlatformAuditEvent_occurredAt_idx" ON "PlatformAuditEvent"("occurredAt");
CREATE INDEX "PlatformAuditEvent_actorUserId_occurredAt_idx" ON "PlatformAuditEvent"("actorUserId", "occurredAt");
CREATE INDEX "PlatformAuditEvent_subjectType_subjectId_occurredAt_idx"
  ON "PlatformAuditEvent"("subjectType", "subjectId", "occurredAt");

ALTER TABLE "PlatformAdministrator"
  ADD CONSTRAINT "PlatformAdministrator_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformSuperAdmin"
  ADD CONSTRAINT "PlatformSuperAdmin_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformAdministratorPermission"
  ADD CONSTRAINT "PlatformAdministratorPermission_administratorId_fkey"
  FOREIGN KEY ("administratorId") REFERENCES "PlatformAdministrator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformAdministratorPermission"
  ADD CONSTRAINT "PlatformAdministratorPermission_grantedByUserId_fkey"
  FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlatformAuditEvent"
  ADD CONSTRAINT "PlatformAuditEvent_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
