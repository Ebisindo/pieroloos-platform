import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { prisma } from "@/lib/db/prisma";
import { mapOperationalAction } from "@/lib/db/operational-action-query";

const assignSchema = z.object({
  assigneeUserId: z.string().min(1),
  expectedUpdatedAt: z.string().datetime(),
});

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

  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid assignee and updated-at value are required." }, { status: 422 });
  }

  const expectedUpdatedAt = new Date(parsed.data.expectedUpdatedAt);
  if (Number.isNaN(expectedUpdatedAt.getTime())) {
    return NextResponse.json({ error: "A valid assignee and updated-at value are required." }, { status: 422 });
  }

  const actionRecord = await prisma.operationalAction.findFirst({
    where: { id, organizationId: principal.organizationId, workspaceId: principal.workspaceId },
  });
  if (!actionRecord) return NextResponse.json({ error: "Operational action not found." }, { status: 404 });
  if (!["OPEN", "ASSIGNED"].includes(actionRecord.status)) {
    return NextResponse.json({ error: "Only open or assigned actions can be assigned." }, { status: 409 });
  }
  if (actionRecord.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
    return NextResponse.json({ error: "Action changed since it was loaded. Refresh before retrying." }, { status: 409 });
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: parsed.data.assigneeUserId, organizationId: principal.organizationId },
    select: { id: true },
  });
  if (!membership) {
    return NextResponse.json({ error: "Assignee must be a member of the active organization." }, { status: 422 });
  }

  const updatedAt = new Date();
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.operationalAction.updateMany({
        where: {
          id,
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          status: { in: ["OPEN", "ASSIGNED"] },
          updatedAt: expectedUpdatedAt,
        },
        data: {
          assigneeUserId: parsed.data.assigneeUserId,
          status: "ASSIGNED",
          updatedAt,
        },
      });
      if (updated.count === 0) throw new Error("STALE_ACTION");

      const record = await transaction.operationalAction.findFirst({
        where: { id, organizationId: principal.organizationId, workspaceId: principal.workspaceId },
      });
      if (!record) throw new Error("ACTION_NOT_FOUND");

      await transaction.operationalActionAuditEvent.create({
        data: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          actionId: id,
          actorUserId: principal.userId,
          eventType: "ACTION_ASSIGNED",
          details: {
            previousAssigneeUserId: actionRecord.assigneeUserId,
            assigneeUserId: parsed.data.assigneeUserId,
            fromStatus: actionRecord.status,
            toStatus: "ASSIGNED",
            expectedUpdatedAt: expectedUpdatedAt.toISOString(),
          },
        },
      });
      return record;
    });

    return NextResponse.json({ data: mapOperationalAction(result) });
  } catch (error) {
    if (error instanceof Error && error.message === "ACTION_NOT_FOUND") {
      return NextResponse.json({ error: "Operational action not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "STALE_ACTION") {
      return NextResponse.json({ error: "Action changed since it was loaded. Refresh before retrying." }, { status: 409 });
    }
    throw error;
  }
}
