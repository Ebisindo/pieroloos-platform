import { ContinuityCaseStatus, PlatformPermission, SuccessorStatus } from "@prisma/client";
import { auth } from "@/lib/auth/auth";
import { prisma } from "@/lib/db/prisma";

export type PlatformActor = {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  permissions: PlatformPermission[];
  organizationIds: string[];
};

export function platformPermissionName(permission: PlatformPermission): string {
  const names: Record<PlatformPermission, string> = {
    [PlatformPermission.DASHBOARD_READ]: "dashboard.read",
    [PlatformPermission.CLIENTS_READ]: "clients.read",
    [PlatformPermission.PARTNERSHIP_INQUIRIES_READ]: "partnership-inquiries.read",
    [PlatformPermission.ADMINS_READ]: "admins.read",
    [PlatformPermission.AUDIT_READ]: "audit.read",
  };
  return names[permission];
}

async function recordOwnerActivity(userId: string) {
  const now = new Date();
  const refreshBefore = new Date(now.getTime() - 5 * 60 * 1000);
  // A small debounce avoids writes on every nested layout while ensuring
  // authenticated server activity keeps the dead-man switch accurate.
  const changed = await prisma.successor.updateMany({
    where: {
      ownerId: userId,
      status: { in: [SuccessorStatus.PENDING, SuccessorStatus.ACCEPTED, SuccessorStatus.ACTIVE] },
      lastOwnerActivityAt: { lt: refreshBefore },
    },
    data: { lastOwnerActivityAt: now, warningSentAt: null },
  });
  if (!changed.count) return;
  await prisma.$transaction(async (tx) => {
    await tx.businessContinuityCase.updateMany({
      where: { successor: { ownerId: userId }, status: { in: [ContinuityCaseStatus.WARNING_SENT, ContinuityCaseStatus.REVIEW_REQUIRED] } },
      data: { status: ContinuityCaseStatus.CANCELLED, cancelledAt: now, closureReason: "Authenticated owner activity detected; dead-man switch reset." },
    });
    await tx.platformAuditEvent.create({
      data: { actorUserId: userId, actorRole: "SUPER_ADMIN", action: "owner_activity_detected", subjectType: "SUCCESSOR_PROTOCOL", outcome: "SUCCESS", details: { heartbeatAt: now.toISOString(), successorRecordsUpdated: changed.count } },
    });
  }, { isolationLevel: "Serializable" });
}

export async function getCurrentPlatformActor(): Promise<PlatformActor | null> {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email;
  if (!userId || !email) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      platformSuperAdmin: { select: { userId: true } },
      platformAdministrator: { select: { permissions: { select: { permission: true } } } },
      memberships: { select: { organizationId: true } },
    },
  });
  if (!user || user.memberships.length === 0) return null;

  const isSuperAdmin = Boolean(user.platformSuperAdmin);
  if (isSuperAdmin) {
    try {
      await recordOwnerActivity(userId);
    } catch {
      // The continuity heartbeat must not take down normal authenticated pages.
      // The separate worker remains fail-safe if activity recording is unavailable.
    }
  }

  return {
    userId,
    email,
    isSuperAdmin,
    permissions: user.platformAdministrator?.permissions.map(({ permission }) => permission) ?? [],
    organizationIds: user.memberships.map(({ organizationId }) => organizationId),
  };
}

export function hasPlatformPermission(actor: PlatformActor, permission: PlatformPermission): boolean {
  return actor.isSuperAdmin || actor.permissions.includes(permission);
}
