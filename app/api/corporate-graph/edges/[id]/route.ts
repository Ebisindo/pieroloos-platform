import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const workspaceContext = await getWorkspaceContext();
  if (!workspaceContext.userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!workspaceContext.principal) {
    return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  }
  if (!workspaceContext.principal.permissions.includes("engagement:write")) {
    return NextResponse.json({ error: "Entity design permission required." }, { status: 403 });
  }

  const { id } = await context.params;
  try {
    const principal = workspaceContext.principal;
    const archived = await withAuthorizedWorkspaceTransaction(principal, "engagement:write", async (tx) => {
      const edge = await tx.corporateGraphEdge.findFirst({
        where: {
          id,
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          archivedAt: null,
        },
        select: { id: true, relation: true, fromNodeId: true, toNodeId: true },
      });
      if (!edge) throw new Error("GRAPH_EDGE_NOT_FOUND");

      const archivedAt = new Date();
      await tx.corporateGraphEdge.update({
        where: { id: edge.id },
        data: { archivedAt, archivedByUserId: principal.userId },
      });
      await tx.corporateGraphAuditEvent.create({
        data: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          actorUserId: principal.userId,
          action: "EDGE_ARCHIVED",
          subjectType: "CorporateGraphEdge",
          subjectId: edge.id,
          details: {
            relation: edge.relation,
            fromNodeId: edge.fromNodeId,
            toNodeId: edge.toNodeId,
          },
        },
      });
      return { id: edge.id, archivedAt };
    });

    return NextResponse.json({ data: archived });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "GRAPH_EDGE_NOT_FOUND") {
      return NextResponse.json({ error: "Active relationship not found in the current workspace." }, { status: 404 });
    }
    console.error("Corporate graph relationship archive failed.", error);
    return NextResponse.json({ error: "Unable to archive graph relationship." }, { status: 500 });
  }
}
