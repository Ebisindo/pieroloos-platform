-- Additive and non-destructive: existing rows keep English delivery.
ALTER TABLE "NotificationPreference" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "ComplianceNotification" ADD COLUMN "templateParams" JSONB;
