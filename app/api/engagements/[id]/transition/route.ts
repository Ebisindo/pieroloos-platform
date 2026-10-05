import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { engagementService } from "@/lib/services/engagement-service";
import { engagementTransitionSchema } from "@/lib/validation/engagement";

export async function POST(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("engagement:write")) {
    return NextResponse.json({ error: "Engagement write permission required." }, { status: 403 });
  }

  const parsed = engagementTransitionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 },
    );
  }
  const { id } = await routeContext.params;
  try {
    const engagement = await engagementService.transition(id, parsed.data, context.principal);
    return NextResponse.json({ data: engagement });
  } catch (error) {
    if (error instanceof Error && error.message === "ENGAGEMENT_NOT_FOUND") {
      return NextResponse.json({ error: "Engagement not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message.startsWith("Invalid engagement transition:")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof Error && error.message === "ENGAGEMENT_CHANGED_CONCURRENTLY") {
      return NextResponse.json({ error: "Engagement changed concurrently. Refresh and try again." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    console.error("Unable to transition engagement.", error);
    return NextResponse.json({ error: "Unable to transition engagement." }, { status: 500 });
  }
}
