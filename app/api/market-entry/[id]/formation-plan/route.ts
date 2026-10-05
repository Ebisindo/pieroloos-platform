import { NextResponse } from "next/server";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { prisma } from "@/lib/db/prisma";

const linkFormationPlanSchema = z.object({
  formationPlanId: z.string().min(1),
  expectedVersion: z.number().int().positive(),
});

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
  if (!context.principal.permissions.includes("formation:write")) {
    return NextResponse.json({ error: "Formation write permission required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = linkFormationPlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A matching formation plan and current pathway version are required." }, { status: 422 });
  }

  const { id } = await params;
  const principal = context.principal;
  const plan = await prisma.marketEntryPlan.findFirst({
    where: { id, workspaceId: principal.workspaceId },
    select: {
      id: true,
      workspaceId: true,
      businessProfileId: true,
      targetJurisdictionId: true,
      formationPlanId: true,
      status: true,
      version: true,
    },
  });
  if (!plan) return NextResponse.json({ error: "Market-entry pathway not found." }, { status: 404 });
  if (plan.version !== parsed.data.expectedVersion) {
    return NextResponse.json({ error: "Market-entry pathway changed. Refresh before retrying." }, { status: 409 });
  }
  if (plan.formationPlanId || !["ASSESSING", "PAUSED"].includes(plan.status)) {
    return NextResponse.json({ error: "A formation plan can only be linked once before pathway execution." }, { status: 409 });
  }

  const formationPlan = await prisma.formationPlan.findFirst({
    where: {
      id: parsed.data.formationPlanId,
      workspaceId: principal.workspaceId,
      businessProfileId: plan.businessProfileId,
      jurisdictionId: plan.targetJurisdictionId,
    },
    select: { id: true },
  });
  if (!formationPlan) {
    return NextResponse.json({ error: "Formation plan must match this profile and target jurisdiction." }, { status: 422 });
  }

  const updatedAt = new Date();
  const result = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.marketEntryPlan.updateMany({
      where: {
        id,
        workspaceId: principal.workspaceId,
        version: parsed.data.expectedVersion,
        formationPlanId: null,
        status: { in: ["ASSESSING", "PAUSED"] },
      },
      data: {
        formationPlanId: formationPlan.id,
        version: { increment: 1 },
        updatedAt,
      },
    });
    if (!updated.count) return null;
    const updatedPlan = await transaction.marketEntryPlan.findFirst({
      where: { id, workspaceId: principal.workspaceId },
    });
    if (!updatedPlan) return null;
    await transaction.marketEntryAuditEvent.create({
      data: {
        marketEntryPlanId: id,
        workspaceId: principal.workspaceId,
        actorUserId: principal.userId,
        eventType: "MARKET_ENTRY_FORMATION_PLAN_LINKED",
        details: { formationPlanId: formationPlan.id, version: updatedPlan.version },
        occurredAt: updatedAt,
      },
    });
    return updatedPlan;
  });
  if (!result) {
    return NextResponse.json({ error: "Market-entry pathway changed. Refresh before retrying." }, { status: 409 });
  }

  return NextResponse.json({ data: result });
}
