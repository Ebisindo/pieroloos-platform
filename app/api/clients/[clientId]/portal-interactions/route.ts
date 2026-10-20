import { NextResponse } from "next/server";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  createWorkspaceClientPortalInteraction,
  listWorkspaceClientPortalInteractions,
} from "@/lib/services/client-portal-service";
import {
  staffPortalInteractionSchema,
} from "@/lib/validation/client-portal-interactions";

type RouteContext = { params: Promise<{ clientId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("client:read")) {
    return NextResponse.json({ error: "Client read permission required." }, { status: 403 });
  }
  try {
    const { clientId } = await params;
    return NextResponse.json({ data: await listWorkspaceClientPortalInteractions(clientId, context.principal) });
  } catch (error) {
    if (error instanceof Error && error.message === "CLIENT_NOT_FOUND") {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    console.error("Unable to load client portal interactions.", error);
    return NextResponse.json({ error: "Unable to load client portal interactions." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("client:write")) {
    return NextResponse.json({ error: "Client write permission required." }, { status: 403 });
  }
  const parsed = staffPortalInteractionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
  }
  try {
    const { clientId } = await params;
    return NextResponse.json({
      data: await createWorkspaceClientPortalInteraction(clientId, context.principal, parsed.data),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "CLIENT_NOT_FOUND") return NextResponse.json({ error: "Client not found." }, { status: 404 });
      if (error.message === "CLIENT_PORTAL_RESOURCE_NOT_FOUND") {
        return NextResponse.json({ error: "Publish the request before sending it to the client." }, { status: 404 });
      }
      if (error.message === "CLIENT_PORTAL_GRANT_NOT_ACTIVE") {
        return NextResponse.json({ error: "An active client portal grant is required for collaboration." }, { status: 409 });
      }
      if (error.message === "WORKSPACE_AUTHORIZATION_STALE") {
        return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
      }
    }
    console.error("Unable to create client portal interaction.", error);
    return NextResponse.json({ error: "Unable to create client portal interaction." }, { status: 500 });
  }
}
