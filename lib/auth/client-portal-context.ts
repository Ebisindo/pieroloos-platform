import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { prisma } from "@/lib/db/prisma";
import type { ClientPortalPrincipal } from "@/lib/auth/client-portal-access";

export async function getClientPortalContext(clientId?: string) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return { userId: null, grants: [], selectedGrant: null, principal: null };

  const grants = await prisma.clientPortalGrant.findMany({
    where: {
      userId,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      ...(clientId ? { clientId } : {}),
    },
    select: {
      id: true,
      organizationId: true,
      workspaceId: true,
      clientId: true,
      canViewStatus: true,
      canViewTasks: true,
      canUploadEvidence: true,
      client: {
        select: {
          id: true,
          name: true,
          firstName: true,
          lastName: true,
          organizationName: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const selectedGrant = clientId
    ? grants.find((grant) => grant.clientId === clientId) ?? null
    : grants.length === 1 ? grants[0] : null;

  const principal: ClientPortalPrincipal | null = selectedGrant
    ? {
        userId,
        organizationId: selectedGrant.organizationId,
        workspaceId: selectedGrant.workspaceId,
        clientId: selectedGrant.clientId,
        clientPortalGrantId: selectedGrant.id,
      }
    : null;

  return { userId, grants, selectedGrant, principal };
}
