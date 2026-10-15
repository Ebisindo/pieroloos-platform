import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { BusinessProfileUpdateInput } from "@/lib/validation/business-profile";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { assertPermission, type WorkspacePrincipal } from "@/lib/auth/workspace-access";

export const businessProfileRepository = {
  async listByWorkspace(principal: WorkspacePrincipal) {
    assertPermission(principal, "client:read");
    return prisma.client.findMany({
      where: { workspaceId: principal.workspaceId, businessProfile: { isNot: null } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, name: true, organizationName: true, proposedBusiness: true,
        email: true, country: true, updatedAt: true,
        businessProfile: true,
      },
      take: 200,
    });
  },

  async findById(id: string, principal: WorkspacePrincipal) {
    assertPermission(principal, "client:read");
    return prisma.businessProfile.findFirst({
      where: { id, client: { workspaceId: principal.workspaceId } },
      include: {
        client: { select: { id: true, name: true, organizationName: true, email: true, country: true, updatedAt: true } },
      },
    });
  },

  async findByClientId(clientId: string, principal: WorkspacePrincipal) {
    assertPermission(principal, "client:read");
    return prisma.businessProfile.findFirst({
      where: { clientId, client: { workspaceId: principal.workspaceId } },
      include: { client: true },
    });
  },

  async update(id: string, data: BusinessProfileUpdateInput, principal: WorkspacePrincipal) {
    return withAuthorizedWorkspaceTransaction(principal, "client:write", async (transaction) => {
      const existing = await transaction.businessProfile.findFirst({
        where: { id, client: { workspaceId: principal.workspaceId } },
        select: { id: true, data: true },
      });
      if (!existing) throw new Error("BUSINESS_PROFILE_NOT_FOUND");

      const currentJson =
        existing.data && typeof existing.data === "object" && !Array.isArray(existing.data)
          ? (existing.data as Record<string, unknown>)
          : {};
      const mergedJson = Object.fromEntries(
        Object.entries({ ...currentJson, ...data }).filter(([, value]) => value !== undefined),
      ) as Prisma.InputJsonObject;

      const updateData: Prisma.BusinessProfileUpdateInput = {
        data: mergedJson,
        version: { increment: 1 },
        ...(data.businessName !== undefined ? { businessName: data.businessName } : {}),
        ...(data.businessType !== undefined ? { businessType: data.businessType } : {}),
        ...(data.objective !== undefined ? { businessObjective: data.objective } : {}),
        ...(data.businessModel !== undefined ? { businessModel: data.businessModel } : {}),
        ...(data.targetMarket !== undefined ? { targetMarket: data.targetMarket } : {}),
        ...(data.revenueModel !== undefined ? { revenueModel: data.revenueModel } : {}),
        ...(data.ownership !== undefined ? { ownershipContext: data.ownership } : {}),
        ...(data.fundingStage !== undefined ? { fundingStage: data.fundingStage } : {}),
        ...(data.expansionObjectives !== undefined ? { expansionObjectives: data.expansionObjectives } : {}),
        ...(data.riskConstraints !== undefined ? { constraints: data.riskConstraints } : {}),
        ...(data.strategicNotes !== undefined ? { strategicNotes: data.strategicNotes } : {}),
        ...(data.operationalContext !== undefined ? { operationalContext: data.operationalContext } : {}),
      };

      const profile = await transaction.businessProfile.update({
        where: { id },
        data: updateData,
      });
      await transaction.activity.create({
        data: {
          workspaceId: principal.workspaceId,
          actorId: principal.userId,
          type: "UPDATED",
          title: "Business profile updated",
          metadata: { businessProfileId: profile.id, version: profile.version },
        },
      });
      return profile;
    });
  },
};
