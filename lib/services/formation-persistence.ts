import type { Prisma } from "@prisma/client";
import type { FormationPlan } from "@/lib/domain/formation";

export async function persistFormationPlan(
  plan: FormationPlan,
  workspaceId: string,
  transaction: Prisma.TransactionClient,
) {
  return transaction.formationPlan.create({
    data: {
      id: plan.id,
      workspaceId,
      clientId: plan.clientId,
      businessProfileId: plan.businessProfileId,
      comparisonSnapshotId: plan.comparisonSnapshotId,
      workingJurisdictionDecisionId: plan.workingJurisdictionDecisionId,
      jurisdictionId: plan.jurisdictionId,
      jurisdictionName: plan.jurisdictionName,
      methodologyVersion: plan.methodologyVersion,
      status: plan.status,
      stages: {
        create: plan.stages.map((stage) => ({
          key: stage.key,
          title: stage.title,
          description: stage.description,
          order: stage.order,
          status: stage.status,
          tasks: {
            create: stage.tasks.map((task) => ({
              key: task.key,
              title: task.title,
              description: task.description,
              order: task.order,
              status: task.status,
              dependsOnTaskKeys: task.dependsOnTaskKeys,
              requiresProfessionalReview: task.requiresProfessionalReview,
              evidenceRequirements: {
                create: task.evidenceRequirements.map((evidence) => ({
                  key: evidence.key,
                  label: evidence.label,
                  required: evidence.required,
                  satisfied: evidence.satisfied,
                })),
              },
            })),
          },
        })),
      },
    },
    include: {
      stages: {
        orderBy: { order: "asc" },
        include: { tasks: { orderBy: { order: "asc" }, include: { evidenceRequirements: true, reviews: true } } },
      },
      workingJurisdictionDecision: true,
    },
  });
}
