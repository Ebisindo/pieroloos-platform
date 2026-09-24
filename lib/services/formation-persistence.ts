import { prisma } from "@/lib/db/prisma";
import { formationRepository } from "@/lib/db/formation-repository";
import type { FormationPlan } from "@/lib/domain/formation";

export async function persistFormationPlan(plan: FormationPlan) {
  // Production: wrap the full aggregate write in a Prisma transaction.
  const savedPlan = await formationRepository.createPlan({
    clientId: plan.clientId,
    businessProfileId: plan.businessProfileId,
    comparisonSnapshotId: plan.comparisonSnapshotId,
    workingJurisdictionDecisionId: plan.workingJurisdictionDecisionId,
    jurisdictionId: plan.jurisdictionId,
    jurisdictionName: plan.jurisdictionName,
    methodologyVersion: plan.methodologyVersion,
    status: plan.status,
  });

  for (const stage of plan.stages) {
    const savedStage = await formationRepository.createStage({
      formationPlanId: savedPlan.id,
      key: stage.key,
      title: stage.title,
      description: stage.description,
      order: stage.order,
      status: stage.status,
    });

    for (const task of stage.tasks) {
      const savedTask = await formationRepository.createTask({
        formationStageId: savedStage.id,
        key: task.key,
        title: task.title,
        description: task.description,
        order: task.order,
        status: task.status,
        dependsOnTaskKeys: task.dependsOnTaskKeys,
        requiresProfessionalReview: task.requiresProfessionalReview,
      });

      for (const evidence of task.evidenceRequirements) {
        await prisma.formationEvidenceRequirement.create({
          data: {
            formationTaskId: savedTask.id,
            key: evidence.key,
            label: evidence.label,
            required: evidence.required,
            satisfied: evidence.satisfied,
          },
        });
      }
    }
  }

  return savedPlan;
}
