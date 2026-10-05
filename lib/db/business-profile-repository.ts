import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import type { BusinessProfileUpdateInput } from "@/lib/validation/business-profile";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { assertPermission, type WorkspacePrincipal } from "@/lib/auth/workspace-access";

export const businessProfileRepository = {
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
        select: { data: true },
      });
      if (!existing) throw new Error("BUSINESS_PROFILE_NOT_FOUND");

      const current =
        existing.data &&
        typeof existing.data === "object" &&
        !Array.isArray(existing.data)
          ? (existing.data as Record<string, unknown>)
          : {};

      const merged = Object.fromEntries(
        Object.entries({ ...current, ...data }).filter(([, value]) => value !== undefined),
      ) as Prisma.InputJsonObject;

      const profile = await transaction.businessProfile.update({
        where: { id },
        data: { data: merged, version: { increment: 1 } },
      });
      await transaction.activity.create({
        data: {
          workspaceId: principal.workspaceId,
          actorId: principal.userId,
          type: "UPDATED",
          title: "Business profile updated",
          metadata: { businessProfileId: profile.id },
        },
      });
      return profile;
    });
  },
};
