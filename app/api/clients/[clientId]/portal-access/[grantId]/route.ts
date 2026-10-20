import { NextResponse } from "next/server";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { revokeClientPortalGrant } from "@/lib/services/client-portal-service";

type RouteContext = { params: Promise<{ clientId: string; grantId: string }> };

export async function DELETE(request: Request, { params }: RouteContext) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("client:write")) {
    return NextResponse.json({ error: "Client write permission required." }, { status: 403 });
  }
  try {
    const { clientId, grantId } = await params;
    return NextResponse.json({
      data: await revokeClientPortalGrant(clientId, grantId, context.principal),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CLIENT_PORTAL_GRANT_NOT_FOUND") {
      return NextResponse.json({ error: "Portal access grant not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    console.error("Unable to revoke client portal access.", error);
    return NextResponse.json({ error: "Unable to revoke client portal access." }, { status: 500 });
  }
}
