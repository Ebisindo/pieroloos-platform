export type WorkspacePermission =
  | "documents:read" | "documents:write" | "documents:review"
  | "compliance:read" | "compliance:write"
  | "reports:read" | "reports:write" | "audit:read";

export type WorkspacePrincipal = {
  userId: string;
  organizationId: string;
  workspaceId: string;
  permissions: WorkspacePermission[];
};

export function hasPermission(principal: WorkspacePrincipal, permission: WorkspacePermission) {
  return principal.permissions.includes(permission);
}

export function assertPermission(principal: WorkspacePrincipal, permission: WorkspacePermission) {
  if (!hasPermission(principal, permission)) throw new Error(`Forbidden: ${permission}`);
}

export function assertSameWorkspace(principal: WorkspacePrincipal, resource: { organizationId: string; workspaceId?: string | null }) {
  if (principal.organizationId !== resource.organizationId) throw new Error("Forbidden: organization boundary violation");
  if (resource.workspaceId && principal.workspaceId !== resource.workspaceId) throw new Error("Forbidden: workspace boundary violation");
}
