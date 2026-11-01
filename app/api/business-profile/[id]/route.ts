import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { businessProfileRepository } from "@/lib/db/business-profile-repository";
import { businessProfileService } from "@/lib/services/business-profile-service";
import { businessProfileUpdateSchema } from "@/lib/validation/business-profile";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_: Request, routeContext: RouteContext) {
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("client:read")) return NextResponse.json({ error: "Client read permission required." }, { status: 403 });

  const { id } = await routeContext.params;
  try {
    const profile = await businessProfileRepository.findById(id, context.principal);
    if (!profile) return NextResponse.json({ error: "Business profile not found in this workspace." }, { status: 404 });
    return NextResponse.json({ data: profile });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    console.error("Unable to load business profile.", error);
    return NextResponse.json({ error: "Unable to load business profile." }, { status: 500 });
  }
}

export async function PATCH(request: Request, routeContext: RouteContext) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("client:write")) return NextResponse.json({ error: "Client write permission required." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = businessProfileUpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed", issues: parsed.error.flatten() }, { status: 422 });

  const { id } = await routeContext.params;
  try {
    const profile = await businessProfileService.update(id, parsed.data, context.principal);
    return NextResponse.json({ data: profile });
  } catch (error) {
    if (error instanceof Error && error.message === "BUSINESS_PROFILE_NOT_FOUND") return NextResponse.json({ error: "Business profile not found in this workspace." }, { status: 404 });
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    console.error("Unable to update business profile.", error);
    return NextResponse.json({ error: "Unable to update business profile." }, { status: 500 });
  }
}
