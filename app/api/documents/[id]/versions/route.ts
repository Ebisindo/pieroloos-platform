import { NextResponse } from "next/server";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { parseDocumentUpload } from "@/lib/http/document-upload";
import { createDocumentVersion } from "@/lib/services/document-storage-service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("documents:write")) {
    return NextResponse.json({ error: "Document write permission required." }, { status: 403 });
  }

  try {
    const upload = await parseDocumentUpload(request);
    const { id } = await params;
    const document = await createDocumentVersion(id, upload, context.principal);
    return NextResponse.json({ data: document }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "DOCUMENT_NOT_FOUND") return NextResponse.json({ error: "Document not found." }, { status: 404 });
      if (error.message === "DOCUMENT_VERSION_CONFLICT") return NextResponse.json({ error: "The document changed concurrently. Retry from the latest version." }, { status: 409 });
      if (error.message === "DOCUMENT_RETENTION_POLICY_REQUIRED") return NextResponse.json({ error: "Configure a workspace document retention policy before uploading document versions." }, { status: 409 });
      if (error.message === "WORKSPACE_AUTHORIZATION_STALE") return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
      if (error.message === "DOCUMENT_TOO_LARGE") return NextResponse.json({ error: "Document exceeds the 25 MiB limit." }, { status: 413 });
      if (error.message === "DOCUMENT_TYPE_NOT_ALLOWED" || error.message === "DOCUMENT_SIGNATURE_MISMATCH") return NextResponse.json({ error: "Document type or file signature is not allowed." }, { status: 415 });
      if (error.message === "DOCUMENT_CHECKSUM_MISMATCH") return NextResponse.json({ error: "Document checksum does not match uploaded bytes." }, { status: 422 });
      if ([
        "INVALID_MULTIPART_BODY",
        "UPLOAD_FIELDS_REQUIRED",
        "INVALID_UPLOAD_DESCRIPTOR",
        "INVALID_DOCUMENT_METADATA",
      ].includes(error.message)) return NextResponse.json({ error: "A valid multipart document upload is required." }, { status: 400 });
    }
    console.error("Unable to store document version.", error);
    return NextResponse.json({ error: "Document storage is unavailable or failed." }, { status: 503 });
  }
}
