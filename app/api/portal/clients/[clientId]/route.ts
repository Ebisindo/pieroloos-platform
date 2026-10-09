import { NextResponse } from "next/server";
import { getClientPortalContext } from "@/lib/auth/client-portal-context";
import { getClientPortalOverview } from "@/lib/services/client-portal-service";

type RouteContext = { params: Promise<{ clientId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { clientId } = await params;
  const context = await getClientPortalContext(clientId);
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal || !context.selectedGrant) {
    return NextResponse.json({ error: "Client portal access not found." }, { status: 404 });
  }
  if (!context.selectedGrant.canViewStatus) {
    return NextResponse.json({ error: "Client status access is not enabled." }, { status: 403 });
  }
  try {
    return NextResponse.json({ data: await getClientPortalOverview(context.principal) });
  } catch (error) {
    if (error instanceof Error && error.message === "CLIENT_PORTAL_ACCESS_REVOKED") {
      return NextResponse.json({ error: "Client portal access has expired or been revoked." }, { status: 403 });
    }
    if (error instanceof Error && error.message === "CLIENT_PORTAL_CLIENT_NOT_FOUND") {
      return NextResponse.json({ error: "Client portal access not found." }, { status: 404 });
    }
    console.error("Unable to load client portal overview.", error);
    return NextResponse.json({ error: "Unable to load client portal overview." }, { status: 500 });
  }
}
