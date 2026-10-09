import { NextResponse } from "next/server";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { setClientPortalTaskVisibility } from "@/lib/services/client-portal-service";
import { clientPortalVisibilitySchema } from "@/lib/validation/client-portal";

type RouteContext = { params: Promise<{ clientId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("client:write")) {
    return NextResponse.json({ error: "Client write permission required." }, { status: 403 });
  }
  const parsed = clientPortalVisibilitySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
  }
  try {
    const { clientId } = await params;
    return NextResponse.json({
      data: await setClientPortalTaskVisibility(clientId, parsed.data, context.principal),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CLIENT_NOT_FOUND") {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "CLIENT_PORTAL_RESOURCE_NOT_FOUND") {
      return NextResponse.json({ error: "Portal resource not found for this client." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    console.error("Unable to update client portal visibility.", error);
    return NextResponse.json({ error: "Unable to update client portal visibility." }, { status: 500 });
  }
}
