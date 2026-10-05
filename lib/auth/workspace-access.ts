import { hasPermission as roleHasPermission, type Permission, type Role } from "./roles";

export type WorkspacePermission =
  | "workspace:read" | "workspace:manage" | "settings:manage"
  | "client:read" | "client:write"
  | "jurisdictions:read" | "jurisdictions:write"
  | "formation:read" | "formation:write" | "engagement:read" | "engagement:write"
  | "documents:read" | "documents:write" | "documents:review"
  | "compliance:read" | "compliance:write"
  | "reports:read" | "reports:write" | "audit:read";

export type WorkspacePrincipal = {
  userId: string;
  organizationId: string;
  workspaceId: string;
  role: Role;
  permissions: WorkspacePermission[];
};

const permissionMap: Record<WorkspacePermission, Permission> = {
  "workspace:read": "workspace:read",
  "workspace:manage": "workspace:manage",
  "settings:manage": "settings:manage",
  "client:read": "client:read",
  "client:write": "client:write",
  "jurisdictions:read": "workspace:read",
  "jurisdictions:write": "workspace:manage",
  "formation:read": "workspace:read",
  "formation:write": "engagement:write",
  "engagement:read": "engagement:read",
  "engagement:write": "engagement:write",
  "documents:read": "evidence:read",
  "documents:write": "evidence:write",
  "documents:review": "evidence:review",
  "compliance:read": "compliance:read",
  "compliance:write": "compliance:write",
  "reports:read": "report:read",
  "reports:write": "report:write",
  "audit:read": "audit:read",
};

export function isRole(value: string): value is Role {
  return ["owner", "admin", "advisor", "member", "viewer"].includes(value);
}

export function permissionsForRole(role: Role): WorkspacePermission[] {
  return (Object.keys(permissionMap) as WorkspacePermission[]).filter((permission) =>
    roleHasPermission(role, permissionMap[permission]),
  );
}

export function hasRolePermission(role: Role, permission: WorkspacePermission): boolean {
  return roleHasPermission(role, permissionMap[permission]);
}

export function hasPermission(principal: WorkspacePrincipal, permission: WorkspacePermission) {
  return principal.permissions.includes(permission);
}

export function assertPermission(principal: WorkspacePrincipal, permission: WorkspacePermission) {
  if (!hasPermission(principal, permission)) throw new Error(`Forbidden: ${permission}`);
}

export function assertSameWorkspace(principal: WorkspacePrincipal, resource: { organizationId: string; workspaceId: string | null | undefined }) {
  if (principal.organizationId !== resource.organizationId) throw new Error("Forbidden: organization boundary violation");
  if (resource.workspaceId == null || principal.workspaceId !== resource.workspaceId) {
    throw new Error("Forbidden: workspace boundary violation");
  }
}
