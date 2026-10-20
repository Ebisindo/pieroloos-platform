import { Prisma } from "@prisma/client";
import type { WorkspacePermission, WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { hasRolePermission, isRole } from "@/lib/auth/workspace-access";
import { prisma } from "@/lib/db/prisma";

export async function withAuthorizedWorkspaceTransaction<T>(
  principal: WorkspacePrincipal,
  permission: WorkspacePermission,
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(
    async (transaction) => {
      const [membership, workspace] = await Promise.all([
        transaction.membership.findUnique({
          where: {
            userId_organizationId: {
              userId: principal.userId,
              organizationId: principal.organizationId,
            },
          },
          select: { role: true },
        }),
        transaction.workspace.findFirst({
          where: {
            id: principal.workspaceId,
            organizationId: principal.organizationId,
          },
          select: { id: true },
        }),
      ]);

      const currentRole = membership?.role.toLowerCase();
      if (
        !membership ||
        !workspace ||
        !currentRole ||
        !isRole(currentRole) ||
        currentRole !== principal.role ||
        !principal.permissions.includes(permission) ||
        !hasRolePermission(currentRole, permission)
      ) {
        throw new Error("WORKSPACE_AUTHORIZATION_STALE");
      }

      return operation(transaction);
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
