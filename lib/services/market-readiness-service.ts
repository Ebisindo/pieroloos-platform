import { prisma } from "@/lib/db/prisma";
import { assessMarketReadiness } from "@/lib/domain/market-entry";

export async function assessMarketEntryReadiness(input: {
  marketEntryPlanId: string;
  workspaceId: string;
  assessedByUserId: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const plan = await prisma.marketEntryPlan.findFirst({
    where: {
      id: input.marketEntryPlanId,
      workspaceId: input.workspaceId,
    },
    select: {
      id: true,
      workspaceId: true,
      version: true,
      businessProfileId: true,
      targetJurisdictionId: true,
      formationPlanId: true,
      reviewStatus: true,
      businessProfile: {
        select: {
          clientId: true,
          businessName: true,
          businessType: true,
          businessObjective: true,
          businessModel: true,
          targetMarket: true,
          revenueModel: true,
          ownershipContext: true,
        },
      },
      formationPlan: {
        select: {
          stages: {
            select: { tasks: { select: { status: true } } },
          },
        },
      },
    },
  });
  if (!plan) return null;

  const obligations = await prisma.complianceObligation.findMany({
    where: {
      workspaceId: input.workspaceId,
      clientId: plan.businessProfile.clientId,
      OR: [
        { jurisdictionId: plan.targetJurisdictionId },
        { jurisdictionId: null },
      ],
    },
    select: {
      status: true,
      requiresEvidence: true,
      evidence: {
        where: {
          reviewStatus: "VERIFIED",
          OR: [{ validThrough: null }, { validThrough: { gte: now } }],
        },
        select: { id: true },
      },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "asc" }],
  });

  const taskStatuses = plan.formationPlan?.stages.flatMap((stage) =>
    stage.tasks.map((task) => task.status),
  ) ?? [];
  const readiness = assessMarketReadiness({
    profile: plan.businessProfile,
    formationPlan: plan.formationPlan
      ? { taskStatuses, taskCount: taskStatuses.length }
      : null,
    obligations: obligations.map((obligation) => ({
      status: obligation.status,
      requiresEvidence: obligation.requiresEvidence,
      evidenceCount: obligation.evidence.length,
    })),
    reviewStatus: plan.reviewStatus,
    assessedAt: now,
  });

  const saved = await prisma.$transaction(async (transaction) => {
    const assessment = await transaction.marketReadinessAssessment.create({
      data: {
        marketEntryPlanId: plan.id,
        workspaceId: plan.workspaceId,
        assessedByUserId: input.assessedByUserId,
        planVersion: plan.version,
        status: readiness.status,
        resultJson: readiness,
        assessedAt: now,
      },
    });
    await transaction.marketEntryAuditEvent.create({
      data: {
        marketEntryPlanId: plan.id,
        workspaceId: plan.workspaceId,
        actorUserId: input.assessedByUserId,
        eventType: "MARKET_READINESS_ASSESSED",
        details: {
          assessmentId: assessment.id,
          status: readiness.status,
          assessedAt: now.toISOString(),
        },
        occurredAt: now,
      },
    });
    return assessment;
  });

  return { id: saved.id, ...readiness };
}
