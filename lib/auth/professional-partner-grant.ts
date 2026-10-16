import { Prisma, type ProfessionalPartnerCapability, type ProfessionalPartnerIdentityStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

type PartnerGrantRow = {
  id: string;
  organizationId: string;
  workspaceId: string;
  clientId: string;
  partnerIdentityId: string;
  capabilities: ProfessionalPartnerCapability[];
  expiresAt: Date | null;
  partnerIdentity: {
    id: string;
    userId: string;
    status: ProfessionalPartnerIdentityStatus;
  };
};

type PartnerGrantOperation<T> = (transaction: Prisma.TransactionClient, grant: PartnerGrantRow) => Promise<T>;

export async function withProfessionalPartnerGrantTransaction<T>(input: {
  userId: string;
  clientId: string;
  capability: ProfessionalPartnerCapability;
  action: string;
  resourceId?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}, operation: PartnerGrantOperation<T>): Promise<T> {
  return prisma.$transaction(async (transaction) => {
    const now = new Date();
    const grant = await transaction.professionalPartnerGrant.findFirst({
      where: {
        clientId: input.clientId,
        status: "ACTIVE",
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        capabilities: { has: input.capability },
        partnerIdentity: {
          userId: input.userId,
          status: "VERIFIED",
        },
      },
      select: {
        id: true,
        organizationId: true,
        workspaceId: true,
        clientId: true,
        partnerIdentityId: true,
        capabilities: true,
        expiresAt: true,
        partnerIdentity: { select: { id: true, userId: true, status: true } },
      },
    });
    if (!grant) throw new Error("PROFESSIONAL_PARTNER_ACCESS_DENIED");

    // Partner status is mutually exclusive with tenant staff membership. Recheck it for every action.
    const membership = await transaction.membership.findUnique({
      where: { userId_organizationId: { userId: input.userId, organizationId: grant.organizationId } },
      select: { id: true },
    });
    if (membership) throw new Error("PROFESSIONAL_PARTNER_ACCESS_DENIED");

    const client = await transaction.client.findFirst({
      where: {
        id: input.clientId,
        workspaceId: grant.workspaceId,
        OR: [{ organizationId: grant.organizationId }, { organizationId: null }],
      },
      select: { id: true },
    });
    if (!client) throw new Error("PROFESSIONAL_PARTNER_RESOURCE_NOT_FOUND");

    const result = await operation(transaction, grant);
    await transaction.professionalPartnerGrantAuditEvent.create({
      data: {
        organizationId: grant.organizationId,
        workspaceId: grant.workspaceId,
        clientId: grant.clientId,
        grantId: grant.id,
        partnerIdentityId: grant.partnerIdentityId,
        actorUserId: input.userId,
        action: input.action,
        metadata: {
          ...input.metadata,
          capability: input.capability,
          resourceId: input.resourceId ?? null,
        } as Prisma.InputJsonValue,
      },
    });
    return result;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export function isPartnerGrantDenied(error: unknown): boolean {
  return error instanceof Error && error.message === "PROFESSIONAL_PARTNER_ACCESS_DENIED";
}
