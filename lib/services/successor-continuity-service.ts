import { ContinuityCaseStatus, Prisma, SuccessorStatus, SuccessorVerificationLevel } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { PlatformActor } from "@/lib/auth/platform-access";
import { createInvitationToken, permissionsAreValid, type SuccessorPermissions, validateInactivityDays } from "@/lib/domain/successor-continuity";

function requireSuperAdmin(actor: PlatformActor) {
  if (!actor.isSuperAdmin) throw new Error("SUPER_ADMIN_REQUIRED");
}

async function assertCurrentSuperAdmin(tx: Prisma.TransactionClient, userId: string) {
  const current = await tx.platformSuperAdmin.findUnique({ where: { id: "singleton" }, select: { userId: true } });
  if (current?.userId !== userId) throw new Error("SUPER_ADMIN_REQUIRED");
}

export async function listSuccessors(actor: PlatformActor) {
  requireSuperAdmin(actor);
  const successors = await prisma.successor.findMany({
    where: { ownerId: actor.userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, successorName: true, successorEmail: true, successorGithub: true,
      relationship: true, status: true, verificationLevel: true, autoActivateAfterDays: true,
      permissions: true, lastOwnerActivityAt: true, warningSentAt: true, createdAt: true,
      acceptedAt: true, idVerifiedAt: true, mfaVerifiedAt: true, highPermissionVerificationNote: true,
      continuityCases: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true, createdAt: true, warningSentAt: true, reviewRequiredAt: true } },
    },
  });
  const assets = await prisma.continuityAsset.findMany({
    where: { ownerId: actor.userId }, orderBy: { createdAt: "desc" },
    select: { id: true, assetType: true, label: true, recoveryLocation: true, criticality: true, notes: true, updatedAt: true },
    take: 100,
  });
  const runbooks = await prisma.continuityRunbook.findMany({
    where: { ownerId: actor.userId }, orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, content: true, version: true, reviewedAt: true, updatedAt: true },
    take: 50,
  });
  return { successors, assets, runbooks };
}

export async function addSuccessor(actor: PlatformActor, input: {
  successorName: string; successorEmail: string; successorGithub?: string;
  relationship: string; autoActivateAfterDays: number; permissions: SuccessorPermissions;
  highPermissionVerificationNote?: string;
}) {
  requireSuperAdmin(actor);
  if (!validateInactivityDays(input.autoActivateAfterDays)) throw new Error("INVALID_INACTIVITY_DAYS");
  if (!permissionsAreValid(input.permissions)) throw new Error("INVALID_PERMISSIONS");
  if (input.permissions.canAccessSecrets && (!input.highPermissionVerificationNote || input.highPermissionVerificationNote.trim().length < 8)) {
    throw new Error("HIGH_PERMISSION_VERIFICATION_REQUIRED");
  }
  const normalizedEmail = input.successorEmail.trim().toLowerCase();
  const { token, tokenHash } = createInvitationToken();
  const now = new Date();
  const created = await prisma.$transaction(async (tx) => {
    await assertCurrentSuperAdmin(tx, actor.userId);
    const sameEmail = await tx.successor.findFirst({
      where: { ownerId: actor.userId, successorEmail: normalizedEmail, status: { not: SuccessorStatus.REVOKED } },
      select: { id: true },
    });
    if (sameEmail) throw new Error("SUCCESSOR_ALREADY_EXISTS");
    const successor = await tx.successor.create({
      data: {
        ownerId: actor.userId,
        successorName: input.successorName.trim(),
        successorEmail: normalizedEmail,
        successorGithub: input.successorGithub?.trim().replace(/^@/, "") || null,
        relationship: input.relationship.trim(),
        autoActivateAfterDays: input.autoActivateAfterDays,
        permissions: input.permissions as unknown as Prisma.InputJsonValue,
        inviteTokenHash: tokenHash,
        inviteExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        lastOwnerActivityAt: now,
        ...(input.permissions.canAccessSecrets ? { highPermissionVerificationNote: input.highPermissionVerificationNote!.trim() } : {}),
      },
      select: { id: true, successorEmail: true, successorName: true },
    });
    await tx.platformAuditEvent.create({ data: {
      actorUserId: actor.userId, actorRole: "SUPER_ADMIN", action: "successor_invited",
      subjectType: "SUCCESSOR", subjectId: successor.id, outcome: "SUCCESS",
      details: { verificationLevel: SuccessorVerificationLevel.EMAIL_INVITE, autoActivateAfterDays: input.autoActivateAfterDays, canAccessSecrets: input.permissions.canAccessSecrets },
    } });
    return successor;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return { successor: created, token };
}

export async function revokeSuccessor(actor: PlatformActor, successorId: string, reason: string) {
  requireSuperAdmin(actor);
  return prisma.$transaction(async (tx) => {
    await assertCurrentSuperAdmin(tx, actor.userId);
    const successor = await tx.successor.findFirst({ where: { id: successorId, ownerId: actor.userId } });
    if (!successor) throw new Error("SUCCESSOR_NOT_FOUND");
    if (successor.status === SuccessorStatus.ACTIVE) throw new Error("ACTIVE_SUCCESSOR_REQUIRES_RECOVERY_REVIEW");
    const updated = await tx.successor.update({
      where: { id: successorId },
      data: { status: SuccessorStatus.REVOKED, inviteTokenHash: null, inviteExpiresAt: null },
      select: { id: true, status: true },
    });
    await tx.businessContinuityCase.updateMany({
      where: { successorId, status: { in: [ContinuityCaseStatus.WARNING_SENT, ContinuityCaseStatus.REVIEW_REQUIRED] } },
      data: { status: ContinuityCaseStatus.CANCELLED, cancelledAt: new Date(), closureReason: reason.trim() },
    });
    await tx.platformAuditEvent.create({ data: {
      actorUserId: actor.userId, actorRole: "SUPER_ADMIN", action: "successor_revoked",
      subjectType: "SUCCESSOR", subjectId: successorId, outcome: "SUCCESS",
      reason: reason.trim(), details: { previousStatus: successor.status },
    } });
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function confirmOwnerAlive(actor: PlatformActor) {
  requireSuperAdmin(actor);
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    await assertCurrentSuperAdmin(tx, actor.userId);
    const updated = await tx.successor.updateMany({
      where: { ownerId: actor.userId, status: { in: [SuccessorStatus.PENDING, SuccessorStatus.ACCEPTED, SuccessorStatus.ACTIVE] } },
      data: { lastOwnerActivityAt: now, warningSentAt: null },
    });
    await tx.businessContinuityCase.updateMany({
      where: { successor: { ownerId: actor.userId }, status: { in: [ContinuityCaseStatus.WARNING_SENT, ContinuityCaseStatus.REVIEW_REQUIRED] } },
      data: { status: ContinuityCaseStatus.CANCELLED, cancelledAt: now, closureReason: "Owner confirmed activity and reset the dead-man switch." },
    });
    await tx.platformAuditEvent.create({ data: {
      actorUserId: actor.userId, actorRole: "SUPER_ADMIN", action: "owner_alive_confirmed",
      subjectType: "SUCCESSOR_PROTOCOL", outcome: "SUCCESS", details: { successorRecordsReset: updated.count },
    } });
    return { resetAt: now.toISOString(), successorRecordsReset: updated.count };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function simulateHandover(actor: PlatformActor, successorId: string) {
  requireSuperAdmin(actor);
  const successor = await prisma.successor.findFirst({
    where: { id: successorId, ownerId: actor.userId },
    select: { id: true, successorName: true, status: true, verificationLevel: true, permissions: true, autoActivateAfterDays: true },
  });
  if (!successor) throw new Error("SUCCESSOR_NOT_FOUND");
  await prisma.platformAuditEvent.create({ data: {
    actorUserId: actor.userId, actorRole: "SUPER_ADMIN", action: "handover_simulated",
    subjectType: "SUCCESSOR", subjectId: successorId, outcome: "SUCCESS",
    details: { status: successor.status, noPrivilegesGranted: true, noProviderStateChanged: true },
  } });
  return {
    successor: successor.successorName, currentStatus: successor.status,
    verificationLevel: successor.verificationLevel, triggerDays: successor.autoActivateAfterDays,
    permissions: permissionsAreValid(successor.permissions) ? successor.permissions : null,
    safeguards: ["No privileges granted", "No ownership changed", "No credentials accessed", "No external providers contacted"],
  };
}

export async function createContinuityAsset(actor: PlatformActor, input: {
  assetType: string; label: string; recoveryLocation: string; criticality: string; notes?: string;
}) {
  requireSuperAdmin(actor);
  return prisma.$transaction(async (tx) => {
    await assertCurrentSuperAdmin(tx, actor.userId);
    const asset = await tx.continuityAsset.create({ data: {
      ownerId: actor.userId, assetType: input.assetType.trim(), label: input.label.trim(),
      recoveryLocation: input.recoveryLocation.trim(), criticality: input.criticality,
      notes: input.notes?.trim() || null,
    } });
    await tx.platformAuditEvent.create({ data: {
      actorUserId: actor.userId, actorRole: "SUPER_ADMIN", action: "continuity_asset_recorded",
      subjectType: "CONTINUITY_ASSET", subjectId: asset.id, outcome: "SUCCESS",
      details: { assetType: asset.assetType, criticality: asset.criticality },
    } });
    return asset;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function saveRunbook(actor: PlatformActor, input: { id?: string; title: string; content: string }) {
  requireSuperAdmin(actor);
  return prisma.$transaction(async (tx) => {
    await assertCurrentSuperAdmin(tx, actor.userId);
    const runbook = input.id
      ? await tx.continuityRunbook.updateMany({ where: { id: input.id, ownerId: actor.userId }, data: { title: input.title.trim(), content: input.content.trim(), version: { increment: 1 }, reviewedAt: null } }).then(async (result) => {
        if (!result.count) throw new Error("RUNBOOK_NOT_FOUND");
        return tx.continuityRunbook.findUniqueOrThrow({ where: { id: input.id! } });
      })
      : await tx.continuityRunbook.create({ data: { ownerId: actor.userId, title: input.title.trim(), content: input.content.trim() } });
    await tx.platformAuditEvent.create({ data: {
      actorUserId: actor.userId, actorRole: "SUPER_ADMIN", action: "continuity_runbook_saved",
      subjectType: "CONTINUITY_RUNBOOK", subjectId: runbook.id, outcome: "SUCCESS",
      details: { version: runbook.version },
    } });
    return runbook;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
