import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { BusinessProfileUpdateInput } from "@/lib/validation/business-profile";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { assertPermission, type WorkspacePrincipal } from "@/lib/auth/workspace-access";

const profileFields = [
  "businessName", "businessType", "businessModel",
  "targetMarket", "revenueModel", "ownership", "fundingStage",
  "expansionObjectives", "riskConstraints", "strategicNotes", "operationalContext", "objective",
] as const;

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
        select: { data: true, businessName: true, businessType: true, businessObjective: true,
          businessModel: true, targetMarket: true, revenueModel: true, ownershipContext: true,
          fundingStage: true, expansionObjectives: true, constraints: true, strategicNotes: true,
          operationalContext: true },
      });
      if (!existing) throw new Error("BUSINESS_PROFILE_NOT_FOUND");

      const currentJson =
        existing.data && typeof existing.data === "object" && !Array.isArray(existing.data)
          ? (existing.data as Record<string, unknown>)
          : {};
      const mergedJson = Object.fromEntries(
        Object.entries({ ...currentJson, ...data }).filter(([, value]) => value !== undefined),
      ) as Prisma.InputJsonObject;

      const scalarData: Record<string, string> = {};
      const jsonOnlyFields = new Set(["ownership", "objective", "riskConstraints", "fundingStage"]);
      for (const field of profileFields) {
        const value = data[field];
        if (value !== undefined && !jsonOnlyFields.has(field)) scalarData[field] = value;
      }

      const profile = await transaction.businessProfile.update({
        where: { id },
        data: {
          ...scalarData,
          ...(data.ownership !== undefined ? { ownershipContext: data.ownership } : {}),
          ...(data.objective !== undefined ? { businessObjective: data.objective } : {}),
          ...(data.riskConstraints !== undefined ? { constraints: data.riskConstraints } : {}),
          data: mergedJson,
          version: { increment: 1 },
        },
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