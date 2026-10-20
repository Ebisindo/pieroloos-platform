import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  nodeType: z.enum([
    "COMPANY",
    "PERSON",
    "TRUST",
    "PARTNERSHIP",
    "BRANCH",
    "BANKING_RELATIONSHIP",
    "LICENSE",
    "TAX_REGISTRATION",
    "OTHER",
  ]).optional(),
  jurisdictionCode: z.string().trim().min(2).max(8).regex(/^[A-Za-z0-9-]+$/).nullable().optional(),
  entityType: z.string().trim().max(80).nullable().optional(),
  registrationNumber: z.string().trim().max(120).nullable().optional(),
}).strict().refine((value) => Object.values(value).some((item) => item !== undefined), {
  message: "Provide at least one field to update.",
});

export async function PATCH(request: Request, context: RouteContext) {
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
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed.", issues: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const principal = workspaceContext.principal;
    const node = await withAuthorizedWorkspaceTransaction(principal, "engagement:write", async (tx) => {
      const existing = await tx.corporateGraphNode.findFirst({
        where: {
          id,
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          archivedAt: null,
        },
        select: { id: true },
      });
      if (!existing) throw new Error("GRAPH_NODE_NOT_FOUND");

      const updated = await tx.corporateGraphNode.update({
        where: { id: existing.id },
        data: {
          ...parsed.data,
          jurisdictionCode: parsed.data.jurisdictionCode === undefined
            ? undefined
            : parsed.data.jurisdictionCode?.toUpperCase() ?? null,
        },
      });

      await tx.corporateGraphAuditEvent.create({
        data: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          actorUserId: principal.userId,
          action: "NODE_UPDATED",
          subjectType: "CorporateGraphNode",
          subjectId: updated.id,
          details: { changedFields: Object.keys(parsed.data) },
        },
      });
      return updated;
    });

    return NextResponse.json({ data: node });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "GRAPH_NODE_NOT_FOUND") {
      return NextResponse.json({ error: "Active entity not found in the current workspace." }, { status: 404 });
    }
    console.error("Corporate graph entity update failed.", error);
    return NextResponse.json({ error: "Unable to update graph entity." }, { status: 500 });
  }
}

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
      const node = await tx.corporateGraphNode.findFirst({
        where: {
          id,
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          archivedAt: null,
        },
        select: { id: true, name: true, nodeType: true },
      });
      if (!node) throw new Error("GRAPH_NODE_NOT_FOUND");

      const archivedAt = new Date();
      const connectedEdges = await tx.corporateGraphEdge.findMany({
        where: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          archivedAt: null,
          OR: [{ fromNodeId: node.id }, { toNodeId: node.id }],
        },
        select: { id: true, fromNodeId: true, toNodeId: true, relation: true },
      });

      if (connectedEdges.length > 0) {
        await tx.corporateGraphEdge.updateMany({
          where: {
            organizationId: principal.organizationId,
            workspaceId: principal.workspaceId,
            archivedAt: null,
            id: { in: connectedEdges.map((edge) => edge.id) },
          },
          data: { archivedAt, archivedByUserId: principal.userId },
        });
      }

      await tx.corporateGraphNode.update({
        where: { id: node.id },
        data: { archivedAt, archivedByUserId: principal.userId },
      });

      await tx.corporateGraphAuditEvent.create({
        data: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          actorUserId: principal.userId,
          action: "NODE_ARCHIVED",
          subjectType: "CorporateGraphNode",
          subjectId: node.id,
          details: { name: node.name, archivedRelationshipCount: connectedEdges.length },
        },
      });

      for (const edge of connectedEdges) {
        await tx.corporateGraphAuditEvent.create({
          data: {
            organizationId: principal.organizationId,
            workspaceId: principal.workspaceId,
            actorUserId: principal.userId,
            action: "EDGE_ARCHIVED",
            subjectType: "CorporateGraphEdge",
            subjectId: edge.id,
            details: { reason: "parent_node_archived", relation: edge.relation },
          },
        });
      }

      return { id: node.id, archivedAt, archivedRelationshipCount: connectedEdges.length };
    });

    return NextResponse.json({ data: archived });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "GRAPH_NODE_NOT_FOUND") {
      return NextResponse.json({ error: "Active entity not found in the current workspace." }, { status: 404 });
    }
    console.error("Corporate graph entity archive failed.", error);
    return NextResponse.json({ error: "Unable to archive graph entity." }, { status: 500 });
  }
}
