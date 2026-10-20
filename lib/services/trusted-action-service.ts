import { Prisma } from "@prisma/client";
import { assertPermission, type WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { actionFromSignal } from "@/lib/domain/action-factory";
import type { OperationalSignal } from "@/lib/domain/operational-intelligence";
import { mapOperationalAction } from "@/lib/db/operational-action-query";
import { prisma } from "@/lib/db/prisma";

const evidenceGapPrefix = "evidence-gap:";

async function resolveTrustedSignal(
  transaction: Prisma.TransactionClient,
  signalId: string,
  principal: WorkspacePrincipal,
): Promise<{ signal: OperationalSignal; clientId: string } | null> {
  if (!signalId.startsWith(evidenceGapPrefix)) return null;

  const obligationId = signalId.slice(evidenceGapPrefix.length);
  if (!obligationId) return null;

  const obligation = await transaction.complianceObligation.findFirst({
    where: {
      id: obligationId,
      organizationId: principal.organizationId,
      workspaceId: principal.workspaceId,
      requiresEvidence: true,
      status: { notIn: ["COMPLETE", "COMPLETED", "COMPLIANT", "WAIVED", "NOT_APPLICABLE"] },
      evidence: { none: {} },
    },
    select: { id: true, title: true, description: true, clientId: true, createdAt: true },
  });

  if (!obligation) return null;

  return {
    clientId: obligation.clientId,
    signal: {
      id: signalId,
      type: "EVIDENCE_GAP",
      severity: "CRITICAL",
      title: "Evidence gap detected",
      description: obligation.description ?? `Required evidence is missing for ${obligation.title}.`,
      obligationId: obligation.id,
      createdAt: obligation.createdAt,
    },
  };
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

export async function createActionFromTrustedSignal(signalId: string, principal: WorkspacePrincipal) {
  assertPermission(principal, "compliance:write");

  const scope = {
    organizationId: principal.organizationId,
    workspaceId: principal.workspaceId,
    sourceSignalId: signalId,
  };

  try {
    return await prisma.$transaction(async (transaction) => {
      const existing = await transaction.operationalAction.findFirst({ where: scope });
      if (existing) return { action: mapOperationalAction(existing), created: false };

      const trusted = await resolveTrustedSignal(transaction, signalId, principal);
      if (!trusted) throw new Error("TRUSTED_SIGNAL_NOT_FOUND");

      const action = actionFromSignal({
        signal: trusted.signal,
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        createdByUserId: principal.userId,
      });
      const createdAction = await transaction.operationalAction.create({
        data: {
          id: action.id,
          organizationId: action.organizationId,
          workspaceId: action.workspaceId,
          title: action.title,
          description: action.description,
          sourceSignalId: action.sourceSignalId,
          clientId: trusted.clientId,
          complianceObligationId: action.complianceObligationId,
          createdByUserId: action.createdByUserId,
          priority: action.priority,
          status: action.status,
          escalationLevel: action.escalationLevel,
          createdAt: action.createdAt,
          updatedAt: action.updatedAt,
        },
      });

      await transaction.operationalActionAuditEvent.create({
        data: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          actionId: createdAction.id,
          actorUserId: principal.userId,
          eventType: "CREATED_FROM_SIGNAL",
          details: {
            sourceSignalId: trusted.signal.id,
            signalType: trusted.signal.type,
            severity: trusted.signal.severity,
          },
        },
      });

      return { action: mapOperationalAction(createdAction), created: true };
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const existing = await prisma.operationalAction.findFirst({ where: scope });
    if (!existing) throw error;
    return { action: mapOperationalAction(existing), created: false };
  }
}