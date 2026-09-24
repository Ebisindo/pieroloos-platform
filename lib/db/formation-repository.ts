import { prisma } from "@/lib/db/prisma";

export const formationRepository = {
  async createWorkingJurisdictionDecision(data: {
    businessProfileId: string;
    comparisonSnapshotId: string;
    jurisdictionId: string;
    rationale?: string;
    decidedByUserId: string;
    professionalReviewRequired: boolean;
    professionalReviewCompleted: boolean;
  }) {
    return prisma.workingJurisdictionDecision.create({ data });
  },

  async createPlan(data: {
    clientId: string;
    businessProfileId: string;
    comparisonSnapshotId: string;
    workingJurisdictionDecisionId: string;
    jurisdictionId: string;
    jurisdictionName: string;
    methodologyVersion: string;
    status: string;
  }) {
    return prisma.formationPlan.create({ data });
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
