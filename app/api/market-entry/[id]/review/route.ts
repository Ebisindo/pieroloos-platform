import { NextResponse } from "next/server";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { prisma } from "@/lib/db/prisma";
import { marketEntryReviewSchema, marketReadinessResultSchema } from "@/lib/validation/market-entry";

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
  if (!context.principal.permissions.includes("documents:review")) {
    return NextResponse.json({ error: "Professional review permission required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = marketEntryReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A review outcome, note, and current version are required." }, { status: 422 });
  }

  const { id } = await params;
  const existing = await prisma.marketEntryPlan.findFirst({
    where: { id, workspaceId: context.principal.workspaceId },
    select: { id: true, version: true, reviewStatus: true },
  });
  if (!existing) return NextResponse.json({ error: "Market-entry pathway not found." }, { status: 404 });
  if (existing.version !== parsed.data.expectedVersion) {
    return NextResponse.json({ error: "Market-entry pathway changed. Refresh before retrying." }, { status: 409 });
  }
  const assessment = await prisma.marketReadinessAssessment.findFirst({
    where: { marketEntryPlanId: id, workspaceId: context.principal.workspaceId },
    orderBy: { assessedAt: "desc" },
    select: { id: true, planVersion: true, status: true, resultJson: true },
  });
  if (!assessment || assessment.planVersion !== existing.version) {
    return NextResponse.json({ error: "Reassess the current pathway before recording a professional review." }, { status: 409 });
  }
  const assessmentResult = marketReadinessResultSchema.safeParse(assessment.resultJson);
  if (!assessmentResult.success || assessment.status !== assessmentResult.data?.status) {
    return NextResponse.json({ error: "The readiness assessment has invalid data and must be recalculated." }, { status: 409 });
  }
  const preparationKeys = ["business-profile", "formalization", "obligations", "obligation-evidence"];
  const preparationChecks = assessmentResult.data.checks.filter((check) =>
    preparationKeys.includes(check.key),
  );
  const preparationComplete = assessmentResult.data.status === "READY_FOR_REVIEW"
    && preparationChecks.length === preparationKeys.length
    && new Set(preparationChecks.map((check) => check.key)).size === preparationKeys.length
    && preparationChecks.every((check) => check.status === "COMPLETE");
  if (parsed.data.reviewStatus === "APPROVED" && !preparationComplete) {
    return NextResponse.json({ error: "The preparation assessment must be ready for review before it can be approved." }, { status: 409 });
  }

  const reviewedAt = new Date();
  const result = await withAuthorizedWorkspaceTransaction(context.principal, "documents:review", async (transaction) => {
    const updated = await transaction.marketEntryPlan.updateMany({
      where: {
        id,
        workspaceId: context.principal!.workspaceId,
        version: parsed.data.expectedVersion,
      },
      data: {
        reviewStatus: parsed.data.reviewStatus,
        reviewNote: parsed.data.note,
        reviewedByUserId: context.principal!.userId,
        reviewedAt,
        reviewedAssessmentVersion: parsed.data.reviewStatus === "APPROVED" ? assessment.planVersion : null,
        version: { increment: 1 },
        updatedAt: reviewedAt,
      },
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
        eventType: "MARKET_ENTRY_REVIEW_RECORDED",
        details: {
          fromReviewStatus: existing.reviewStatus,
          toReviewStatus: parsed.data.reviewStatus,
          assessmentId: assessment.id,
          note: parsed.data.note,
          version: plan.version,
        },
        occurredAt: reviewedAt,
      },
    });
    return plan;
  });
  if (!result) {
    return NextResponse.json({ error: "Market-entry pathway changed. Refresh before retrying." }, { status: 409 });
  }

  return NextResponse.json({ data: result });
}
