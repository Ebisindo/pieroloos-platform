import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { engagementRepository } from "@/lib/db/engagement-repository";
import { engagementService } from "@/lib/services/engagement-service";
import { engagementCreateSchema } from "@/lib/validation/engagement";
import { ENGAGEMENT_STATUSES, type EngagementStatus } from "@/lib/domain/engagement";

export async function GET(request: Request) {
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("engagement:read")) {
    return NextResponse.json({ error: "Engagement read permission required." }, { status: 403 });
  }

  const url = new URL(request.url);
  const statusValue = url.searchParams.get("status");
  if (statusValue && !ENGAGEMENT_STATUSES.includes(statusValue as EngagementStatus)) {
    return NextResponse.json({ error: "Invalid engagement status filter." }, { status: 422 });
  }
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 120);
  try {
    const engagements = await engagementRepository.listByWorkspace(context.principal, {
      status: statusValue as EngagementStatus | undefined,
      query,
    });
    return NextResponse.json({ data: engagements });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    console.error("Unable to list engagements.", error);
    return NextResponse.json({ error: "Unable to list engagements." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("engagement:write")) {
    return NextResponse.json({ error: "Engagement write permission required." }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = engagementCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });
  }
  try {
    const engagement = await engagementService.create(parsed.data, context.principal);
    return NextResponse.json({ data: engagement }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "CLIENT_NOT_FOUND") {
      return NextResponse.json({ error: "Client not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    console.error("Unable to create engagement.", error);
    return NextResponse.json({ error: "Unable to create engagement." }, { status: 500 });
  }
}
