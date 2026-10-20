import { NextResponse } from "next/server";
import { enforceRateLimit, PORTAL_READ_LIMIT } from "@/lib/http/rate-limit";
import { getClientPortalContext } from "@/lib/auth/client-portal-context";
import { createClientPortalDocumentDownloadUrl } from "@/lib/services/client-portal-service";

type RouteContext = { params: Promise<{ clientId: string; documentId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { clientId, documentId } = await params;
  const context = await getClientPortalContext(clientId);
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const limited = await enforceRateLimit(PORTAL_READ_LIMIT, context.userId);
  if (limited) return limited;
  if (!context.principal || !context.selectedGrant) {
    return NextResponse.json({ error: "Client portal access not found." }, { status: 404 });
  }
  try {
    const url = await createClientPortalDocumentDownloadUrl(context.principal, documentId);
    return NextResponse.redirect(url);
  } catch (error) {
    if (error instanceof Error && error.message === "CLIENT_PORTAL_DOCUMENT_NOT_FOUND") {
      return NextResponse.json({ error: "Evidence document not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "CLIENT_PORTAL_ACCESS_REVOKED") {
      return NextResponse.json({ error: "Client portal access has expired or been revoked." }, { status: 403 });
    }
    console.error("Unable to create client portal evidence download.", error);
    return NextResponse.json({ error: "Unable to create evidence download." }, { status: 500 });
  }
}
