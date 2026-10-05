import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/auth-options";
import { isRole, permissionsForRole, type WorkspacePrincipal } from "@/lib/auth/workspace-access";
import type { Role } from "@/lib/auth/roles";
import { prisma } from "@/lib/db/prisma";

export type AccessibleWorkspace = {
  id: string;
  name: string;
  organizationId: string;
  role: Role;
};

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

  const workspaces: AccessibleWorkspace[] = memberships.flatMap((membership) => {
    const role = membership.role.toLowerCase();
    if (!isRole(role)) {
      throw new Error(`Unsupported membership role "${membership.role}" for user "${userId}".`);
    }
    return membership.organization.workspaces.map((workspace) => ({
      ...workspace,
      organizationId: membership.organizationId,
      role,
    }));
  });

  const cookieJar = await cookies();
  const requestedWorkspaceId = cookieJar.get("active-workspace")?.value;
  const activeWorkspace = workspaces.find((workspace) => workspace.id === requestedWorkspaceId)
    ?? (workspaces.length === 1 ? workspaces[0] : null);

  const principal: WorkspacePrincipal | null = activeWorkspace
    ? {
        userId,
        organizationId: activeWorkspace.organizationId,
        workspaceId: activeWorkspace.id,
        role: activeWorkspace.role,
        permissions: permissionsForRole(activeWorkspace.role),
      }
    : null;

  return { userId, workspaces, activeWorkspace, principal };
}