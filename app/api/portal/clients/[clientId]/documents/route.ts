import { NextResponse } from "next/server";
import { enforceRateLimit, PORTAL_READ_LIMIT, PORTAL_UPLOAD_LIMIT } from "@/lib/http/rate-limit";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getClientPortalContext } from "@/lib/auth/client-portal-context";
import { parseDocumentUpload } from "@/lib/http/document-upload";
import {
  listClientPortalDocuments,
} from "@/lib/services/client-portal-service";
import { uploadClientPortalEvidence } from "@/lib/services/document-storage-service";

type RouteContext = { params: Promise<{ clientId: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { clientId } = await params;
  const context = await getClientPortalContext(clientId);
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const limited = await enforceRateLimit(PORTAL_READ_LIMIT, context.userId);
  if (limited) return limited;
  if (!context.principal || !context.selectedGrant) {
    return NextResponse.json({ error: "Client portal access not found." }, { status: 404 });
  }
  try {
    return NextResponse.json({ data: await listClientPortalDocuments(context.principal) });
  } catch (error) {
    if (error instanceof Error && error.message === "CLIENT_PORTAL_ACCESS_REVOKED") {
      return NextResponse.json({ error: "Client portal access has expired or been revoked." }, { status: 403 });
    }
    console.error("Unable to list client portal evidence.", error);
    return NextResponse.json({ error: "Unable to list client portal evidence." }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const { clientId } = await params;
  const context = await getClientPortalContext(clientId);
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const limited = await enforceRateLimit(PORTAL_UPLOAD_LIMIT, context.userId);
  if (limited) return limited;
  if (!context.principal || !context.selectedGrant) {
    return NextResponse.json({ error: "Client portal access not found." }, { status: 404 });
  }
  if (!context.selectedGrant.canUploadEvidence) {
    return NextResponse.json({ error: "Evidence upload is not enabled." }, { status: 403 });
  }

  try {
    const upload = await parseDocumentUpload(request);
    const document = await uploadClientPortalEvidence(upload, context.principal);
    return NextResponse.json({
      data: {
        id: document.id,
        name: document.name,
        status: document.status,
        scanStatus: document.scanStatus,
        reviewStatus: document.reviewStatus,
        createdAt: document.createdAt,
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "DOCUMENT_TOO_LARGE") return NextResponse.json({ error: "Document exceeds the 25 MiB limit." }, { status: 413 });
      if (["INVALID_MULTIPART_BODY", "UPLOAD_FIELDS_REQUIRED", "INVALID_UPLOAD_DESCRIPTOR", "INVALID_DOCUMENT_METADATA"].includes(error.message)) {
        return NextResponse.json({ error: "A valid multipart document upload is required." }, { status: 400 });
      }
      if (error.message === "DOCUMENT_TYPE_NOT_ALLOWED" || error.message === "DOCUMENT_SIGNATURE_MISMATCH") {
        return NextResponse.json({ error: "Document type or file signature is not allowed." }, { status: 415 });
      }
      if (error.message === "DOCUMENT_CHECKSUM_MISMATCH") return NextResponse.json({ error: "Document checksum does not match uploaded bytes." }, { status: 422 });
      if (error.message === "DOCUMENT_RETENTION_POLICY_REQUIRED") return NextResponse.json({ error: "The professional workspace must configure document retention before uploads." }, { status: 409 });
      if (error.message === "CLIENT_PORTAL_ACCESS_REVOKED") return NextResponse.json({ error: "Client portal access has expired or been revoked." }, { status: 403 });
      if (error.message === "CLIENT_PORTAL_CLIENT_MISMATCH") return NextResponse.json({ error: "Evidence can only be uploaded to the granted client record." }, { status: 422 });
    }
    console.error("Unable to store client portal evidence.", error);
    return NextResponse.json({ error: "Evidence storage is unavailable or failed." }, { status: 503 });
  }
}
