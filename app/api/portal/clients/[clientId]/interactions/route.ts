import { NextResponse } from "next/server";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getClientPortalContext } from "@/lib/auth/client-portal-context";
import { enforceRateLimit, PORTAL_INTERACTION_LIMIT, PORTAL_READ_LIMIT } from "@/lib/http/rate-limit";
import {
  createClientPortalInteraction,
  listClientPortalInteractions,
} from "@/lib/services/client-portal-service";
import { clientPortalInteractionSchema } from "@/lib/validation/client-portal-interactions";

type RouteContext = { params: Promise<{ clientId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { clientId } = await params;
  const context = await getClientPortalContext(clientId);
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal || !context.selectedGrant) {
    return NextResponse.json({ error: "Client portal access not found." }, { status: 404 });
  }
  const limited = await enforceRateLimit(PORTAL_READ_LIMIT, context.userId);
  if (limited) return limited;
  try {
    return NextResponse.json({ data: await listClientPortalInteractions(context.principal) });
  } catch (error) {
    if (error instanceof Error && error.message === "CLIENT_PORTAL_ACCESS_REVOKED") {
      return NextResponse.json({ error: "Client portal access has expired or been revoked." }, { status: 403 });
    }
    console.error("Unable to load client portal interactions.", error);
    return NextResponse.json({ error: "Unable to load client portal interactions." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const { clientId } = await params;
  const context = await getClientPortalContext(clientId);
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal || !context.selectedGrant) {
    return NextResponse.json({ error: "Client portal access not found." }, { status: 404 });
  }
  const limited = await enforceRateLimit(PORTAL_INTERACTION_LIMIT, context.userId);
  if (limited) return limited;
  const parsed = clientPortalInteractionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
  }
  try {
    return NextResponse.json(
      { data: await createClientPortalInteraction(context.principal, parsed.data) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "CLIENT_PORTAL_ACCESS_REVOKED") {
        return NextResponse.json({ error: "Client portal access has expired or been revoked." }, { status: 403 });
      }
      if (error.message === "CLIENT_PORTAL_RESOURCE_NOT_FOUND") {
        return NextResponse.json({ error: "The requested item is not available in this client portal." }, { status: 404 });
      }
      if (error.message === "CLIENT_PORTAL_ACKNOWLEDGMENT_REQUEST_NOT_FOUND") {
        return NextResponse.json({ error: "Acknowledgment request not found or already answered." }, { status: 404 });
      }
      if (error.message === "CLIENT_PORTAL_SUBMISSION_PENDING") {
        return NextResponse.json({ error: "A submission for this request is already awaiting professional review." }, { status: 409 });
      }
    }
    console.error("Unable to create client portal interaction.", error);
    return NextResponse.json({ error: "Unable to create client portal interaction." }, { status: 500 });
  }
}
