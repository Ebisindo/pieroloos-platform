import { assertPermission, assertSameWorkspace, type WorkspacePrincipal } from "./workspace-access";
import type { OperationalAction } from "@/lib/domain/action-control";

export function authorizeActionRead(principal: WorkspacePrincipal, action: OperationalAction) {
  assertSameWorkspace(principal, action);
  assertPermission(principal, "compliance:read");
}

export function authorizeActionWrite(principal: WorkspacePrincipal, action: OperationalAction) {
  assertSameWorkspace(principal, action);
  assertPermission(principal, "compliance:write");
}

export function authorizeActionResolve(principal: WorkspacePrincipal, action: OperationalAction) {
  assertSameWorkspace(principal, action);
  assertPermission(principal, "compliance:write");
}
