import { auth } from "@/lib/auth/auth";
import type { AuthContext } from "./session";
import type { Role } from "./roles";

export async function getPieroloSession(): Promise<AuthContext | null> {
  const session = await auth();
  if (!session?.user) return null;

  return {
    sessionId: session.user.id ?? session.user.email ?? "unknown",
    user: {
      id: session.user.id ?? session.user.email ?? "unknown",
      organizationId: "",
      workspaceIds: [],
      email: session.user.email ?? "",
      name: session.user.name ?? undefined,
      role: "viewer" as Role,
    },
  };
}
