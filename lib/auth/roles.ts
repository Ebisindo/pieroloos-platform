export const ROLES = ["owner", "admin", "advisor", "analyst", "member", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "workspace:read",
  "workspace:manage",
  "client:read",
  "client:write",
  "client:delete",
  "engagement:read",
  "engagement:write",
  "engagement:delete",
  "evidence:read",
  "evidence:write",
  "evidence:review",
  "report:read",
  "report:write",
  "compliance:read",
  "compliance:write",
  "settings:manage",
  "audit:read",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const rolePermissions: Record<Role, readonly Permission[]> = {
  owner: PERMISSIONS,
  admin: PERMISSIONS.filter((p) => p !== "settings:manage"),
  advisor: ["workspace:read", "client:read", "client:write", "engagement:read", "engagement:write", "evidence:read", "evidence:write", "evidence:review", "report:read", "report:write", "compliance:read", "compliance:write"],
  analyst: ["workspace:read", "client:read", "client:write", "engagement:read", "engagement:write", "evidence:read", "evidence:write", "report:read", "report:write", "compliance:read", "compliance:write"],
  member: ["workspace:read", "client:read", "client:write", "engagement:read", "engagement:write", "evidence:read", "evidence:write", "report:read", "compliance:read", "compliance:write"],
  viewer: ["workspace:read", "client:read", "engagement:read", "evidence:read", "report:read", "compliance:read"],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}
