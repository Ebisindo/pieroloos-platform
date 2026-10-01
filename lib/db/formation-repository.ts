import { prisma } from "@/lib/db/prisma";

export const formationRepository = {
  async createWorkingJurisdictionDecision(data: {
    workspaceId: string;
    businessProfileId: string;
    comparisonSnapshotId: string;
    jurisdictionId: string;
    rationale?: string;
    decidedByUserId: string;
    professionalReviewRequired: boolean;
    professionalReviewCompleted: boolean;
  }) {
    return prisma.workingJurisdictionDecision.create({
      data: {
        workspaceId: data.workspaceId,
        businessProfileId: data.businessProfileId,
        comparisonSnapshotId: data.comparisonSnapshotId,
        jurisdictionId: data.jurisdictionId,
        rationale: data.rationale,
        decidedByUserId: data.decidedByUserId,
        professionalReviewRequired: data.professionalReviewRequired,
        professionalReviewCompleted: data.professionalReviewCompleted,
      },
    });
  },

  async createPlan(data: {
    workspaceId: string;
    clientId: string;
    businessProfileId: string;
    comparisonSnapshotId: string;
    workingJurisdictionDecisionId: string;
    jurisdictionId: string;
    jurisdictionName: string;
    methodologyVersion: string;
    status: string;
  }) {
    return prisma.formationPlan.create({
      data: {
        workspaceId: data.workspaceId,
        clientId: data.clientId,
        businessProfileId: data.businessProfileId,
        comparisonSnapshotId: data.comparisonSnapshotId,
        workingJurisdictionDecisionId: data.workingJurisdictionDecisionId,
        jurisdictionId: data.jurisdictionId,
        jurisdictionName: data.jurisdictionName,
        methodologyVersion: data.methodologyVersion,
        status: data.status,
      },
    });
  },

  async createStage(data: {
    formationPlanId: string;
    key: string;
    title: string;
    description: string;
    order: number;
    status: string;
  }) {
    return prisma.formationStage.create({ data });
  },

  async createTask(data: {
    formationStageId: string;
    key: string;
    title: string;
    description: string;
    order: number;
    status: string;
    dependsOnTaskKeys: string[];
    requiresProfessionalReview: boolean;
  }) {
    return prisma.formationTask.create({ data });
  },

  async getPlan(id: string) {
    return prisma.formationPlan.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: { order: "asc" },
          include: {
            tasks: {
              orderBy: { order: "asc" },
              include: { evidenceRequirements: true, reviews: true },
            },
          },
        },
        workingJurisdictionDecision: true,
      },
    });
  },

  async updateTask(id: string, data: {
    status?: string;
    blockingReason?: string | null;
    completionNote?: string | null;
    completedAt?: Date | null;
  }) {
    return prisma.formationTask.update({ where: { id }, data });
  },
};
