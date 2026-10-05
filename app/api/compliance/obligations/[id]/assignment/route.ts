import { NextResponse } from "next/server";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { prisma } from "@/lib/db/prisma";
import { assignComplianceObligationSchema } from "@/lib/validation/compliance";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("compliance:write")) {
    return NextResponse.json({ error: "Compliance write permission required." }, { status: 403 });
  }
  const principal = context.principal;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = assignComplianceObligationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid workspace member or null owner is required." }, { status: 422 });
  }

  const { id } = await params;
  const existing = await prisma.complianceObligation.findFirst({
    where: { id, workspaceId: principal.workspaceId },
    select: { id: true, ownerUserId: true },
  });
  if (!existing) return NextResponse.json({ error: "Compliance obligation not found." }, { status: 404 });

  if (parsed.data.ownerUserId) {
    const membership = await prisma.membership.findFirst({
      where: {
        userId: parsed.data.ownerUserId,
        organizationId: principal.organizationId,
      },
      select: { userId: true },
    });
    if (!membership) {
      return NextResponse.json({ error: "The assigned owner must be a member of this organization." }, { status: 422 });
    }
  }

  try {
    const result = await withAuthorizedWorkspaceTransaction(principal, "compliance:write", async (transaction) => {
      if (parsed.data.ownerUserId) {
        const currentMembership = await transaction.membership.findFirst({
          where: {
            userId: parsed.data.ownerUserId,
            organizationId: principal.organizationId,
          },
          select: { id: true },
        });
        if (!currentMembership) throw new Error("ASSIGNEE_NOT_MEMBER");
      }
      const updated = await transaction.complianceObligation.updateMany({
        where: { id: existing.id, workspaceId: principal.workspaceId },
        data: { ownerUserId: parsed.data.ownerUserId },
      });
      if (updated.count !== 1) throw new Error("OBLIGATION_NOT_FOUND");
      const obligation = await transaction.complianceObligation.findFirst({
        where: { id: existing.id, workspaceId: principal.workspaceId },
      });
      if (!obligation) throw new Error("OBLIGATION_NOT_FOUND");
      await transaction.complianceActivity.create({
        data: {
          obligationId: obligation.id,
          action: parsed.data.ownerUserId ? "OWNER_ASSIGNED" : "OWNER_UNASSIGNED",
          actorUserId: principal.userId,
          metadata: {
            previousOwnerUserId: existing.ownerUserId,
            ownerUserId: parsed.data.ownerUserId,
          },
        },
      });
      return obligation;
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof Error && error.message === "ASSIGNEE_NOT_MEMBER") {
      return NextResponse.json({ error: "The assigned owner must be a member of this organization." }, { status: 422 });
    }
    if (error instanceof Error && error.message === "OBLIGATION_NOT_FOUND") {
      return NextResponse.json({ error: "Compliance obligation not found." }, { status: 404 });
    }
    throw error;
  }
}
