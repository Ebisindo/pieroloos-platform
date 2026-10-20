import { NextResponse } from "next/server";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import {
  createClientPortalGrant,
  listClientPortalGrants,
} from "@/lib/services/client-portal-service";
import { clientPortalGrantSchema } from "@/lib/validation/client-portal";

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
    return NextResponse.json({ data: await listClientPortalGrants(clientId, context.principal) });
  } catch (error) {
    if (error instanceof Error && error.message === "CLIENT_NOT_FOUND") {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    console.error("Unable to list client portal access.", error);
    return NextResponse.json({ error: "Unable to list client portal access." }, { status: 500 });
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
  const parsed = clientPortalGrantSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
  }
  try {
    const { clientId } = await params;
    const grant = await createClientPortalGrant(clientId, parsed.data.email, context.principal);
    return NextResponse.json({ data: grant }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "CLIENT_NOT_FOUND") return NextResponse.json({ error: "Client not found." }, { status: 404 });
      if (error.message === "CLIENT_EMAIL_REQUIRED") return NextResponse.json({ error: "Set the client's email before granting portal access." }, { status: 409 });
      if (error.message === "CLIENT_PORTAL_EMAIL_MISMATCH") return NextResponse.json({ error: "Portal access email must match the client record." }, { status: 422 });
      if (error.message === "CLIENT_PORTAL_USER_NOT_PROVISIONED") return NextResponse.json({ error: "The client's OIDC/GitHub user account must be provisioned before access can be granted." }, { status: 409 });
      if (error.message === "WORKSPACE_AUTHORIZATION_STALE") return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    console.error("Unable to grant client portal access.", error);
    return NextResponse.json({ error: "Unable to grant client portal access." }, { status: 500 });
  }
}
