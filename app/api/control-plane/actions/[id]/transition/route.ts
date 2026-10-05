import { NextResponse } from "next/server";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { z } from "zod";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
import { mapOperationalAction } from "@/lib/db/operational-action-query";
import { transitionAction, type ControlActionStatus } from "@/lib/domain/action-control";

const transitionSchema = z.object({
  status: z.enum(["IN_PROGRESS", "BLOCKED", "PENDING_REVIEW", "CANCELLED"]),
  expectedUpdatedAt: z.string().datetime(),
});

function mapAuditEventType(status: ControlActionStatus) {
  switch (status) {
    case "ASSIGNED": return "ACTION_ASSIGNED";
    case "IN_PROGRESS": return "ACTION_STARTED";
    case "BLOCKED": return "ACTION_BLOCKED";
    case "PENDING_REVIEW": return "ACTION_SUBMITTED_FOR_REVIEW";
    case "CANCELLED": return "ACTION_CANCELLED";
    default: return "ACTION_CREATED";
  }
}

function isRecordNotFoundError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2025";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const { id } = await params;

  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const principal = context.principal;
  if (!principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!principal.permissions.includes("compliance:write")) {
    return NextResponse.json({ error: "Compliance write permission required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = transitionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid action status and updated-at value are required." }, { status: 422 });
  }

  const expectedUpdatedAt = new Date(parsed.data.expectedUpdatedAt);
  if (Number.isNaN(expectedUpdatedAt.getTime())) {
    return NextResponse.json({ error: "A valid action status and updated-at value are required." }, { status: 422 });
  }

  try {
    const action = await prisma.operationalAction.findFirst({
      where: { id, organizationId: principal.organizationId, workspaceId: principal.workspaceId },
    });
    if (!action) return NextResponse.json({ error: "Operational action not found." }, { status: 404 });

    const current = mapOperationalAction(action);
    let next;
    try {
      next = transitionAction(current, parsed.data.status, new Date());
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Invalid action transition:")) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      throw error;
    }

    const updated = await withAuthorizedWorkspaceTransaction(principal, "compliance:write", async (tx) => {
      const latest = await tx.operationalAction.findFirst({
        where: { id, organizationId: principal.organizationId, workspaceId: principal.workspaceId },
      });
      if (!latest) throw new Error("ACTION_NOT_FOUND");
      if (latest.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
        throw new Error("STALE_ACTION");
      }

      const updatedAction = await tx.operationalAction.update({
        where: {
          id,
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          updatedAt: expectedUpdatedAt,
        },
        data: {
          status: next.status,
          updatedAt: next.updatedAt,
          resolvedAt: next.resolvedAt,
          resolutionNote: next.resolutionNote ?? null,
        },
      });

      await tx.operationalActionAuditEvent.create({
        data: {
          organizationId: latest.organizationId,
          workspaceId: latest.workspaceId,
          actionId: latest.id,
          actorUserId: principal.userId,
          eventType: mapAuditEventType(parsed.data.status),
          details: {
            fromStatus: current.status,
            toStatus: next.status,
            expectedUpdatedAt: expectedUpdatedAt.toISOString(),
          },
        },
      });

      return updatedAction;
    });

    return NextResponse.json({ data: mapOperationalAction(updated) });
  } catch (error) {
    if (error instanceof Error && error.message === "ACTION_NOT_FOUND") {
      return NextResponse.json({ error: "Operational action not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "STALE_ACTION") {
      return NextResponse.json({ error: "Action changed since it was loaded. Refresh before retrying." }, { status: 409 });
    }
    if (isRecordNotFoundError(error)) {
      return NextResponse.json({ error: "Action changed since it was loaded. Refresh before retrying." }, { status: 409 });
    }
    throw error;
  }
}
