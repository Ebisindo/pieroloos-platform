import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { hasPermission, type Permission, type Role } from "@/lib/auth/roles";
import type { WorkspacePermission, WorkspacePrincipal } from "@/lib/auth/workspace-access";
import { prisma } from "@/lib/db/prisma";

export type AccessibleWorkspace = {
  id: string;
  name: string;
  organizationId: string;
  role: Role;
};

const permissionMap: Array<[WorkspacePermission, Permission]> = [
  ["workspace:read", "workspace:read"],
  ["workspace:manage", "workspace:manage"],
  ["settings:manage", "settings:manage"],
  ["jurisdictions:read", "workspace:read"],
  ["jurisdictions:write", "workspace:manage"],
  ["formation:read", "workspace:read"],
  ["formation:write", "engagement:write"],
  ["documents:read", "evidence:read"],
  ["documents:write", "evidence:write"],
  ["documents:review", "evidence:review"],
  ["compliance:read", "compliance:read"],
  ["compliance:write", "compliance:write"],
  ["reports:read", "report:read"],
  ["reports:write", "report:write"],
  ["audit:read", "audit:read"],
];

export async function getWorkspaceContext() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    return { userId: null, workspaces: [], activeWorkspace: null, principal: null };
  }

  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: {
      organizationId: true,
      role: true,
      organization: {
        select: { workspaces: { select: { id: true, name: true } } },
      },
    },
  });

  const workspaces: AccessibleWorkspace[] = memberships.flatMap((membership) =>
    membership.organization.workspaces.map((workspace) => ({
      ...workspace,
      organizationId: membership.organizationId,
      role: membership.role.toLowerCase() as Role,
    })),
  );

  const cookieJar = await cookies();
  const requestedWorkspaceId = cookieJar.get("active-workspace")?.value;
  const activeWorkspace = workspaces.find((workspace) => workspace.id === requestedWorkspaceId)
    ?? (workspaces.length === 1 ? workspaces[0] : null);

  const principal: WorkspacePrincipal | null = activeWorkspace
    ? {
        userId,
        organizationId: activeWorkspace.organizationId,
        workspaceId: activeWorkspace.id,
        permissions: permissionMap
          .filter(([, rolePermission]) => hasPermission(activeWorkspace.role, rolePermission))
          .map(([permission]) => permission),
      }
    : null;

  return { userId, workspaces, activeWorkspace, principal };
}