import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { engagementRepository } from "@/lib/db/engagement-repository";
import { activityRepository } from "@/lib/db/activity-repository";
import { activityService } from "@/lib/services/activity-service";
import { activityCreateSchema } from "@/lib/validation/engagement";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  const workspaceContext = await getWorkspaceContext();
  if (!workspaceContext.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!workspaceContext.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!workspaceContext.principal.permissions.includes("engagement:read")) {
    return NextResponse.json({ error: "Engagement read permission required." }, { status: 403 });
  }
  const { id } = await context.params;
  const engagement = await engagementRepository.findById(id, workspaceContext.principal);
  if (!engagement) return NextResponse.json({ error: "Engagement not found." }, { status: 404 });
  return NextResponse.json({
    data: await activityRepository.listByEngagement(id, workspaceContext.principal),
  });
}

export async function POST(request: Request, context: Context) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const workspaceContext = await getWorkspaceContext();
  if (!workspaceContext.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!workspaceContext.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!workspaceContext.principal.permissions.includes("engagement:write")) {
    return NextResponse.json({ error: "Engagement write permission required." }, { status: 403 });
  }
  const { id } = await context.params;
  try {
    const body = await request.json();
    const parsed = activityCreateSchema.safeParse({ ...body, engagementId: id });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 }
      );
    }
    return NextResponse.json({
      data: await activityService.create({
        engagementId: id,
        type: parsed.data.type,
        title: parsed.data.title,
        description: parsed.data.description,
      }, workspaceContext.principal),
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ENGAGEMENT_NOT_FOUND") {
      return NextResponse.json({ error: "Engagement not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    console.error("Unable to record engagement activity.", error);
    return NextResponse.json({ error: "Unable to record activity." }, { status: 500 });
  }
}
