import { NextResponse } from "next/server";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { canTransitionMarketEntry, type MarketEntryStatus } from "@/lib/domain/market-entry";
import { prisma } from "@/lib/db/prisma";
import { updateMarketEntryStatusSchema } from "@/lib/validation/market-entry";

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
  if (!context.principal.permissions.includes("jurisdictions:write")) {
    return NextResponse.json({ error: "Market-entry management permission required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = updateMarketEntryStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid status and current version are required." }, { status: 422 });
  }

  const { id } = await params;
  const existing = await prisma.marketEntryPlan.findFirst({
    where: { id, workspaceId: context.principal.workspaceId },
  });
  if (!existing) return NextResponse.json({ error: "Market-entry pathway not found." }, { status: 404 });
  if (existing.version !== parsed.data.expectedVersion) {
    return NextResponse.json({ error: "Market-entry pathway changed. Refresh before retrying." }, { status: 409 });
  }
  if (!canTransitionMarketEntry(existing.status as MarketEntryStatus, parsed.data.status)) {
    return NextResponse.json({ error: `Invalid pathway transition: ${existing.status} -> ${parsed.data.status}.` }, { status: 409 });
  }
  if (parsed.data.status === "IN_PROGRESS" && existing.reviewStatus !== "APPROVED") {
    return NextResponse.json({ error: "A qualified professional review must be recorded before work starts." }, { status: 409 });
  }
  if (parsed.data.status === "IN_PROGRESS") {
    const latestAssessment = await prisma.marketReadinessAssessment.findFirst({
      where: { marketEntryPlanId: id, workspaceId: context.principal.workspaceId },
      orderBy: { assessedAt: "desc" },
      select: { planVersion: true },
    });
    if (!latestAssessment || existing.reviewedAssessmentVersion !== latestAssessment.planVersion) {
      return NextResponse.json({ error: "The latest preparation assessment must be professionally reviewed before work starts." }, { status: 409 });
    }
  }
  if (parsed.data.status === "COMPLETED" && existing.reviewStatus !== "APPROVED") {
    return NextResponse.json({ error: "A qualified professional review must be recorded before completion." }, { status: 409 });
  }

  const updatedAt = new Date();
  const result = await withAuthorizedWorkspaceTransaction(context.principal, "jurisdictions:write", async (transaction) => {
    const updated = await transaction.marketEntryPlan.updateMany({
      where: {
        id,
        workspaceId: context.principal!.workspaceId,
        version: parsed.data.expectedVersion,
      },
      data: { status: parsed.data.status, version: { increment: 1 }, updatedAt },
    });
    if (!updated.count) return null;
    const plan = await transaction.marketEntryPlan.findFirst({
      where: { id, workspaceId: context.principal!.workspaceId },
    });
    if (!plan) return null;
    await transaction.marketEntryAuditEvent.create({
      data: {
        marketEntryPlanId: id,
        workspaceId: context.principal!.workspaceId,
        actorUserId: context.principal!.userId,
        eventType: "MARKET_ENTRY_STATUS_CHANGED",
        details: { fromStatus: existing.status, toStatus: parsed.data.status, version: plan.version },
      },
    });
    return plan;
  });
  if (!result) {
    return NextResponse.json({ error: "Market-entry pathway changed. Refresh before retrying." }, { status: 409 });
  }

  return NextResponse.json({ data: result });
}
