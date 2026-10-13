import { PlatformPermission } from "@prisma/client";
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

export async function getCurrentPlatformActor(): Promise<PlatformActor | null> {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email;
  if (!userId || !email) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      platformSuperAdmin: { select: { userId: true } },
      platformAdministrator: {
        select: { permissions: { select: { permission: true } } },
      },
      memberships: { select: { organizationId: true } },
    },
  });
  if (!user || user.memberships.length === 0) return null;

  return {
    userId,
    email,
    isSuperAdmin: Boolean(user.platformSuperAdmin),
    permissions: user.platformAdministrator?.permissions.map(({ permission }) => permission) ?? [],
    organizationIds: user.memberships.map(({ organizationId }) => organizationId),
  };
}

export function hasPlatformPermission(actor: PlatformActor, permission: PlatformPermission): boolean {
  return actor.isSuperAdmin || actor.permissions.includes(permission);
}
