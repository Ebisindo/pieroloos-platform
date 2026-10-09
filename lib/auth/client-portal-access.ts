import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type ClientPortalCapability = "VIEW_STATUS" | "VIEW_TASKS" | "UPLOAD_EVIDENCE";

export type ClientPortalPrincipal = {
  userId: string;
  organizationId: string;
  workspaceId: string;
  clientId: string;
  clientPortalGrantId: string;
};

function capabilityWhere(capability: ClientPortalCapability) {
  switch (capability) {
    case "VIEW_STATUS":
      return { canViewStatus: true };
    case "VIEW_TASKS":
      return { canViewTasks: true };
    case "UPLOAD_EVIDENCE":
      return { canUploadEvidence: true };
  }
}

export async function withClientPortalGrantTransaction<T>(
  principal: ClientPortalPrincipal,
  capability: ClientPortalCapability,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (transaction) => {
    const grant = await transaction.clientPortalGrant.findFirst({
      where: {
        id: principal.clientPortalGrantId,
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        clientId: principal.clientId,
        userId: principal.userId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        ...capabilityWhere(capability),
      },
      select: { id: true },
    });
    if (!grant) throw new Error("CLIENT_PORTAL_ACCESS_REVOKED");

    return operation(transaction);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
