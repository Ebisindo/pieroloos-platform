import { NextResponse } from "next/server";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { reviewClientPortalCompletionSubmission } from "@/lib/services/client-portal-service";
import { clientPortalReviewSchema } from "@/lib/validation/client-portal-interactions";

type RouteContext = { params: Promise<{ clientId: string; interactionId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("client:write")) {
    return NextResponse.json({ error: "Client write permission required." }, { status: 403 });
  }
  const parsed = clientPortalReviewSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
  }
  try {
    const { clientId, interactionId } = await params;
    return NextResponse.json({
      data: await reviewClientPortalCompletionSubmission(
        clientId,
        interactionId,
        context.principal,
        parsed.data.decision,
        parsed.data.note,
      ),
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "CLIENT_PORTAL_SUBMISSION_NOT_FOUND") {
        return NextResponse.json({ error: "Pending completion submission not found." }, { status: 404 });
      }
      if (error.message === "WORKSPACE_AUTHORIZATION_STALE") {
        return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
      }
    }
    console.error("Unable to review client portal submission.", error);
    return NextResponse.json({ error: "Unable to review client portal submission." }, { status: 500 });
  }
}
