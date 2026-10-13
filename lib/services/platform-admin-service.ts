import { PlatformPermission, Prisma } from "@prisma/client";
import { hasPlatformPermission, platformPermissionName, type PlatformActor } from "@/lib/auth/platform-access";
import { prisma } from "@/lib/db/prisma";

function requirePermission(actor: PlatformActor, permission: PlatformPermission) {
  if (!hasPlatformPermission(actor, permission)) throw new Error("PLATFORM_PERMISSION_DENIED");
}

export async function getPlatformDashboard(actor: PlatformActor) {
  requirePermission(actor, PlatformPermission.DASHBOARD_READ);

  const clientScope = actor.isSuperAdmin
    ? {}
    : { workspace: { organizationId: { in: actor.organizationIds } } };
  const canReadClients = hasPlatformPermission(actor, PlatformPermission.CLIENTS_READ);
  const canReadInquiries = hasPlatformPermission(actor, PlatformPermission.PARTNERSHIP_INQUIRIES_READ);
  const canReadAdministrators = hasPlatformPermission(actor, PlatformPermission.ADMINS_READ);
  const canReadAudit = hasPlatformPermission(actor, PlatformPermission.AUDIT_READ);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    clientCount,
    recentClientCount,
    recentClients,
    inquiryCount,
    recentInquiries,
    administratorCount,
    recentAuditEvents,
  ] = await Promise.all([
    prisma.client.count({ where: clientScope }),
    prisma.client.count({ where: { ...clientScope, createdAt: { gte: thirtyDaysAgo } } }),
    canReadClients
      ? prisma.client.findMany({
          where: clientScope,
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true,
            name: true,
            organizationName: true,
            createdAt: true,
          },
        })
      : Promise.resolve(null),
    canReadInquiries
      ? prisma.partnershipInquiry.count({ where: { status: { in: ["NEW", "IN_REVIEW"] } } })
      : Promise.resolve(null),
    canReadInquiries
      ? prisma.partnershipInquiry.findMany({
          where: { status: { in: ["NEW", "IN_REVIEW"] } },
          orderBy: { createdAt: "desc" },
          take: 6,
          select: {
            id: true,
            organisationName: true,
            partnerType: true,
            status: true,
            createdAt: true,
          },
        })
      : Promise.resolve(null),
    canReadAdministrators ? prisma.platformAdministrator.count() : Promise.resolve(null),
    canReadAudit
      ? prisma.platformAuditEvent.findMany({
          orderBy: { occurredAt: "desc" },
          take: 8,
          select: {
            id: true,
            actorRole: true,
            action: true,
            subjectType: true,
            occurredAt: true,
            actor: { select: { name: true } },
          },
        })
      : Promise.resolve(null),
  ]);

  const readAuditEvents: Prisma.PlatformAuditEventCreateManyInput[] = [];
  if (canReadClients) {
    readAuditEvents.push({
      actorUserId: actor.userId,
      actorRole: actor.isSuperAdmin ? "SUPER_ADMIN" : "ADMIN",
      action: "ADMIN_CLIENT_RECORDS_READ",
      subjectType: "CLIENT",
      outcome: "SUCCESS",
      details: { resultCount: recentClients?.length ?? 0 },
    });
  }
  if (canReadInquiries) {
    readAuditEvents.push({
      actorUserId: actor.userId,
      actorRole: actor.isSuperAdmin ? "SUPER_ADMIN" : "ADMIN",
      action: "PARTNERSHIP_INQUIRIES_READ",
      subjectType: "PARTNERSHIP_INQUIRY",
      outcome: "SUCCESS",
      details: { resultCount: recentInquiries?.length ?? 0 },
    });
  }
  if (readAuditEvents.length) {
    await prisma.platformAuditEvent.createMany({ data: readAuditEvents });
  }

  return {
    clientCount,
    recentClientCount,
    recentClients,
    inquiryCount,
    recentInquiries,
    administratorCount,
    superAdminCount: actor.isSuperAdmin ? await prisma.platformSuperAdmin.count() : null,
    recentAuditEvents,
  };
}

export async function recordPlatformAuditEvent(input: {
  actorUserId?: string;
  actorRole: string;
  action: string;
  subjectType?: string;
  subjectId?: string;
  outcome: "SUCCESS" | "DENIED";
  reason?: string;
  details?: Prisma.InputJsonValue;
}) {
  return prisma.platformAuditEvent.create({
    data: {
      ...input,
      actorUserId: input.actorUserId ?? null,
      subjectType: input.subjectType ?? null,
      subjectId: input.subjectId ?? null,
      reason: input.reason ?? null,
      details: input.details,
    },
    select: { id: true },
  });
}

export async function listPlatformAdministrators(actor: PlatformActor) {
  requirePermission(actor, PlatformPermission.ADMINS_READ);
  const [administrators, eligibleUsers] = await Promise.all([
    prisma.platformAdministrator.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
        permissions: { select: { permission: true, createdAt: true } },
      },
    }),
    actor.isSuperAdmin
      ? prisma.user.findMany({
          where: { memberships: { some: {} }, platformSuperAdmin: null },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve(null),
  ]);
  return { administrators, eligibleUsers };
}

function permissionNames(permissions: PlatformPermission[]) {
  return permissions.map(platformPermissionName);
}

async function assertCurrentSuperAdmin(
  transaction: Prisma.TransactionClient,
  actorUserId: string,
) {
  const current = await transaction.platformSuperAdmin.findUnique({
    where: { id: "singleton" },
    select: { userId: true },
  });
  if (current?.userId !== actorUserId) throw new Error("SUPER_ADMIN_REQUIRED");
}

export async function setPlatformAdministratorPermissions(
  actor: PlatformActor,
  targetUserId: string,
  permissions: PlatformPermission[],
  reason: string,
) {
  if (!actor.isSuperAdmin) throw new Error("SUPER_ADMIN_REQUIRED");
  if (
    (permissions.includes(PlatformPermission.CLIENTS_READ) || permissions.includes(PlatformPermission.AUDIT_READ)) &&
    !permissions.includes(PlatformPermission.DASHBOARD_READ)
  ) {
    throw new Error("DASHBOARD_PERMISSION_REQUIRED");
  }

  return prisma.$transaction(async (transaction) => {
    await assertCurrentSuperAdmin(transaction, actor.userId);
    const target = await transaction.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        memberships: { select: { id: true }, take: 1 },
        platformSuperAdmin: { select: { userId: true } },
      },
    });
    if (!target) throw new Error("ADMIN_TARGET_NOT_FOUND");
    if (target.platformSuperAdmin) throw new Error("CANNOT_MODIFY_SUPER_ADMIN");
    if (!target.memberships.length) throw new Error("ADMIN_TARGET_NOT_STAFF");

    const administrator = await transaction.platformAdministrator.upsert({
      where: { userId: targetUserId },
      create: { userId: targetUserId },
      update: {},
      select: { id: true },
    });
    await transaction.platformAdministratorPermission.deleteMany({
      where: { administratorId: administrator.id },
    });
    if (permissions.length) {
      await transaction.platformAdministratorPermission.createMany({
        data: permissions.map((permission) => ({
          administratorId: administrator.id,
          permission,
          grantedByUserId: actor.userId,
        })),
      });
    }
    await transaction.platformAuditEvent.create({
      data: {
        actorUserId: actor.userId,
        actorRole: "SUPER_ADMIN",
        action: "PLATFORM_ADMIN_PERMISSIONS_SET",
        subjectType: "USER",
        subjectId: targetUserId,
        outcome: "SUCCESS",
        reason,
        details: { permissions: permissionNames(permissions) },
      },
    });
    return administrator;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function revokePlatformAdministrator(actor: PlatformActor, targetUserId: string, reason: string) {
  if (!actor.isSuperAdmin) throw new Error("SUPER_ADMIN_REQUIRED");

  return prisma.$transaction(async (transaction) => {
    await assertCurrentSuperAdmin(transaction, actor.userId);
    const target = await transaction.platformAdministrator.findUnique({
      where: { userId: targetUserId },
      select: { id: true },
    });
    if (!target) throw new Error("ADMIN_TARGET_NOT_FOUND");

    await transaction.platformAdministrator.delete({ where: { id: target.id } });
    await transaction.platformAuditEvent.create({
      data: {
        actorUserId: actor.userId,
        actorRole: "SUPER_ADMIN",
        action: "PLATFORM_ADMIN_REVOKED",
        subjectType: "USER",
        subjectId: targetUserId,
        outcome: "SUCCESS",
        reason,
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
