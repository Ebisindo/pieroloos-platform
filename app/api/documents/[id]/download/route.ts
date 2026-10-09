import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { createDocumentDownloadUrl } from "@/lib/services/document-storage-service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("documents:read")) {
    return NextResponse.json({ error: "Document read permission required." }, { status: 403 });
  }

  try {
    const url = await createDocumentDownloadUrl(id, context.principal);
    return NextResponse.redirect(url, 302);
  } catch (error) {
    if (error instanceof Error && error.message === "DOCUMENT_NOT_FOUND") {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "DOCUMENT_INFECTED") {
      return NextResponse.json({ error: "Infected documents cannot be downloaded." }, { status: 410 });
    }
    if (error instanceof Error && error.message === "DOCUMENT_NOT_READY") {
      return NextResponse.json({ error: "Document is unavailable pending security scanning." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    console.error("Unable to issue document download URL.", error);
    return NextResponse.json({ error: "Document storage is unavailable." }, { status: 503 });
  }
}
