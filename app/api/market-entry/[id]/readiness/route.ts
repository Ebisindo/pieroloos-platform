import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { assessMarketEntryReadiness } from "@/lib/services/market-readiness-service";

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
  if (!context.principal.permissions.includes("jurisdictions:write")) {
    return NextResponse.json({ error: "Market-readiness assessment permission required." }, { status: 403 });
  }

  const { id } = await params;
  const assessment = await assessMarketEntryReadiness({
    marketEntryPlanId: id,
    workspaceId: context.principal.workspaceId,
    assessedByUserId: context.principal.userId,
  });
  if (!assessment) return NextResponse.json({ error: "Market-entry pathway not found." }, { status: 404 });

  return NextResponse.json({ data: assessment }, { status: 201 });
}
