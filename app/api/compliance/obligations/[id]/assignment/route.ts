import { NextResponse } from "next/server";
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
    where: { id, workspaceId: context.principal.workspaceId },
    select: { id: true, ownerUserId: true },
  });
  if (!existing) return NextResponse.json({ error: "Compliance obligation not found." }, { status: 404 });

  if (parsed.data.ownerUserId) {
    const membership = await prisma.membership.findFirst({
      where: {
        userId: parsed.data.ownerUserId,
        organizationId: context.principal.organizationId,
      },
      select: { userId: true },
    });
    if (!membership) {
      return NextResponse.json({ error: "The assigned owner must be a member of this organization." }, { status: 422 });
    }
  }

  const result = await prisma.$transaction(async (transaction) => {
    const obligation = await transaction.complianceObligation.update({
      where: { id: existing.id },
      data: { ownerUserId: parsed.data.ownerUserId },
    });
    await transaction.complianceActivity.create({
      data: {
        obligationId: obligation.id,
        action: parsed.data.ownerUserId ? "OWNER_ASSIGNED" : "OWNER_UNASSIGNED",
        actorUserId: context.principal!.userId,
        metadata: {
          previousOwnerUserId: existing.ownerUserId,
          ownerUserId: parsed.data.ownerUserId,
        },
      },
    });
    return obligation;
  });

  return NextResponse.json({ data: result });
}
