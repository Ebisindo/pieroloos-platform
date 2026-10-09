import { NextResponse } from "next/server";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { softDeleteDocument } from "@/lib/services/document-storage-service";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("documents:delete")) {
    return NextResponse.json({ error: "Document delete permission required." }, { status: 403 });
  }

  try {
    const { id } = await params;
    const result = await softDeleteDocument(id, context.principal);
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof Error && error.message === "DOCUMENT_NOT_FOUND") return NextResponse.json({ error: "Document not found." }, { status: 404 });
    if (error instanceof Error && error.message === "DOCUMENT_RETENTION_ACTIVE") return NextResponse.json({ error: "Document retention policy prevents deletion until the retention date." }, { status: 409 });
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    console.error("Unable to soft-delete document.", error);
    return NextResponse.json({ error: "Unable to delete document." }, { status: 500 });
  }
}
