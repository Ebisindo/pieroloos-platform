import { auth } from "@/lib/auth/auth";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import type { AuthContext } from "./session";

export async function getPieroloSession(): Promise<AuthContext | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;
  const workspaceContext = await getWorkspaceContext();
  if (!workspaceContext.principal) return null;

  return {
    sessionId: session.user.id,
    user: {
      id: session.user.id,
      organizationId: workspaceContext.principal.organizationId,
      workspaceIds: workspaceContext.workspaces
        .filter((workspace) => workspace.organizationId === workspaceContext.principal?.organizationId)
        .map((workspace) => workspace.id),
      email: session.user.email,
      name: session.user.name ?? undefined,
      role: workspaceContext.principal.role,
    },
  };
}
