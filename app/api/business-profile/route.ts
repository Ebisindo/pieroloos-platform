import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { businessProfileRepository } from "@/lib/db/business-profile-repository";

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("client:read")) return NextResponse.json({ error: "Client read permission required." }, { status: 403 });
  try {
    return NextResponse.json({ data: await businessProfileRepository.listByWorkspace(context.principal) });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    console.error("Unable to list business profiles.", error);
    return NextResponse.json({ error: "Unable to list business profiles." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  return NextResponse.json({ error: "A profile identifier is required." }, { status: 400 });
}
