import type { Role } from "@/lib/auth/roles";

/** Billing records are organization-scoped; do not expose them to ordinary workspace members. */
export function canManageBilling(role: Role | null | undefined): boolean {
  return role === "owner" || role === "admin";
}
