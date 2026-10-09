import { NextResponse } from "next/server";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { documentReviewSchema } from "@/lib/validation/document";
import { reviewDocument } from "@/lib/services/document-storage-service";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("documents:review")) {
    return NextResponse.json({ error: "Document review permission required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = documentReviewSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid document review.", issues: parsed.error.flatten() }, { status: 422 });

  try {
    const { id } = await params;
    const result = await reviewDocument(id, {
      reviewStatus: parsed.data.reviewStatus,
      reviewNote: parsed.data.reviewNote,
    }, context.principal);
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof Error && error.message === "DOCUMENT_NOT_FOUND") return NextResponse.json({ error: "Document not found or not ready for review." }, { status: 404 });
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    console.error("Unable to review document.", error);
    return NextResponse.json({ error: "Unable to save document review." }, { status: 500 });
  }
}
