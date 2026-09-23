import type { Permission, Role } from "./roles";

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  workspaceIds: string[];
  email: string;
  name?: string;
  role: Role;
}

export interface AuthContext {
  user: AuthenticatedUser;
  sessionId: string;
}

export interface SessionProvider {
  getCurrentSession(): Promise<AuthContext | null>;
}

export function assertAuthenticated(session: AuthContext | null): asserts session is AuthContext {
  if (!session) throw new Error("AUTHENTICATION_REQUIRED");
}

export function assertWorkspaceAccess(session: AuthContext, workspaceId: string): void {
  if (!session.user.workspaceIds.includes(workspaceId)) throw new Error("WORKSPACE_ACCESS_DENIED");
}

export function assertPermission(role: Role, permission: Permission, checker: (role: Role, permission: Permission) => boolean): void {
  if (!checker(role, permission)) throw new Error("PERMISSION_DENIED");
}
