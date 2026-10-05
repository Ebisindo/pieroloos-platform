import { prisma } from "@/lib/db/prisma";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { assertPermission, type WorkspacePrincipal } from "@/lib/auth/workspace-access";

export const formationRepository = {
  async createWorkingJurisdictionDecision(data: {
    businessProfileId: string;
    comparisonSnapshotId: string;
    jurisdictionId: string;
    rationale?: string;
    decidedByUserId: string;
    professionalReviewRequired: boolean;
    professionalReviewCompleted: boolean;
  }, principal: WorkspacePrincipal) {
    return withAuthorizedWorkspaceTransaction(principal, "formation:write", async (transaction) => {
      const [profile, comparison, jurisdiction] = await Promise.all([
        transaction.businessProfile.findFirst({
          where: { id: data.businessProfileId, client: { workspaceId: principal.workspaceId } },
          select: { id: true },
        }),
        transaction.jurisdictionComparison.findFirst({
          where: {
            id: data.comparisonSnapshotId,
            workspaceId: principal.workspaceId,
            businessProfileId: data.businessProfileId,
          },
          select: { id: true },
        }),
        transaction.jurisdiction.findFirst({
          where: {
            id: data.jurisdictionId,
            OR: [{ workspaceId: principal.workspaceId }, { workspaceId: null }],
          },
          select: { id: true },
        }),
      ]);
      if (!profile || !comparison || !jurisdiction) throw new Error("FORMATION_RESOURCE_NOT_FOUND");

      const decision = await transaction.workingJurisdictionDecision.create({
        data: {
          workspaceId: principal.workspaceId,
          businessProfileId: profile.id,
          comparisonSnapshotId: comparison.id,
          jurisdictionId: jurisdiction.id,
          rationale: data.rationale,
          decidedByUserId: principal.userId,
          professionalReviewRequired: data.professionalReviewRequired,
          professionalReviewCompleted: data.professionalReviewCompleted,
        },
      });
      await transaction.activity.create({
        data: {
          workspaceId: principal.workspaceId,
          actorId: principal.userId,
          type: "CREATED",
          title: "Working jurisdiction decision created",
          summary: "A workspace-scoped jurisdiction decision was recorded.",
          metadata: { decisionId: decision.id, jurisdictionId: jurisdiction.id },
        },
      });
      return decision;
    });
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
  }, principal: WorkspacePrincipal) {
    return withAuthorizedWorkspaceTransaction(principal, "formation:write", async (transaction) => {
      const [client, profile, comparison, decision, jurisdiction] = await Promise.all([
        transaction.client.findFirst({
          where: { id: data.clientId, workspaceId: principal.workspaceId },
          select: { id: true },
        }),
        transaction.businessProfile.findFirst({
          where: { id: data.businessProfileId, client: { workspaceId: principal.workspaceId } },
          select: { id: true, clientId: true },
        }),
        transaction.jurisdictionComparison.findFirst({
          where: {
            id: data.comparisonSnapshotId,
            workspaceId: principal.workspaceId,
            businessProfileId: data.businessProfileId,
          },
          select: { id: true },
        }),
        transaction.workingJurisdictionDecision.findFirst({
          where: {
            id: data.workingJurisdictionDecisionId,
            workspaceId: principal.workspaceId,
            businessProfileId: data.businessProfileId,
            comparisonSnapshotId: data.comparisonSnapshotId,
            jurisdictionId: data.jurisdictionId,
          },
          select: { id: true },
        }),
        transaction.jurisdiction.findFirst({
          where: {
            id: data.jurisdictionId,
            OR: [{ workspaceId: principal.workspaceId }, { workspaceId: null }],
          },
          select: { id: true },
        }),
      ]);
      if (!client || !profile || profile.clientId !== client.id || !comparison || !decision || !jurisdiction) {
        throw new Error("FORMATION_RESOURCE_NOT_FOUND");
      }
      const plan = await transaction.formationPlan.create({
        data: {
          workspaceId: principal.workspaceId,
          clientId: client.id,
          businessProfileId: profile.id,
          comparisonSnapshotId: comparison.id,
          workingJurisdictionDecisionId: decision.id,
          jurisdictionId: jurisdiction.id,
          jurisdictionName: data.jurisdictionName,
          methodologyVersion: data.methodologyVersion,
          status: data.status,
        },
      });
      await transaction.activity.create({
        data: {
          workspaceId: principal.workspaceId,
          actorId: principal.userId,
          type: "CREATED",
          title: "Formation plan created",
          metadata: { formationPlanId: plan.id },
        },
      });
      return plan;
    });
  },

  async createStage(data: {
    formationPlanId: string;
    key: string;
    title: string;
    description: string;
    order: number;
    status: string;
  }, principal: WorkspacePrincipal) {
    return withAuthorizedWorkspaceTransaction(principal, "formation:write", async (transaction) => {
      const plan = await transaction.formationPlan.findFirst({
        where: { id: data.formationPlanId, workspaceId: principal.workspaceId },
        select: { id: true },
      });
      if (!plan) throw new Error("FORMATION_PLAN_NOT_FOUND");
      const stage = await transaction.formationStage.create({ data: { ...data, formationPlanId: plan.id } });
      await transaction.activity.create({
        data: {
          workspaceId: principal.workspaceId,
          actorId: principal.userId,
          type: "CREATED",
          title: "Formation stage created",
          metadata: { formationPlanId: plan.id, formationStageId: stage.id },
        },
      });
      return stage;
    });
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
  }, principal: WorkspacePrincipal) {
    return withAuthorizedWorkspaceTransaction(principal, "formation:write", async (transaction) => {
      const stage = await transaction.formationStage.findFirst({
        where: {
          id: data.formationStageId,
          formationPlan: { workspaceId: principal.workspaceId },
        },
        select: { id: true, formationPlanId: true },
      });
      if (!stage) throw new Error("FORMATION_STAGE_NOT_FOUND");
      const task = await transaction.formationTask.create({ data: { ...data, formationStageId: stage.id } });
      await transaction.activity.create({
        data: {
          workspaceId: principal.workspaceId,
          actorId: principal.userId,
          type: "CREATED",
          title: "Formation task created",
          metadata: {
            formationPlanId: stage.formationPlanId,
            formationStageId: stage.id,
            formationTaskId: task.id,
          },
        },
      });
      return task;
    });
  },

  async getPlan(id: string, principal: WorkspacePrincipal) {
    assertPermission(principal, "formation:read");
    return prisma.formationPlan.findFirst({
      where: { id, workspaceId: principal.workspaceId },
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
  }, principal: WorkspacePrincipal) {
    return withAuthorizedWorkspaceTransaction(principal, "formation:write", async (transaction) => {
      const task = await transaction.formationTask.findFirst({
        where: { id, formationStage: { formationPlan: { workspaceId: principal.workspaceId } } },
        select: { id: true, formationStage: { select: { formationPlanId: true, id: true } } },
      });
      if (!task) throw new Error("FORMATION_TASK_NOT_FOUND");
      const updated = await transaction.formationTask.update({ where: { id: task.id }, data });
      await transaction.activity.create({
        data: {
          workspaceId: principal.workspaceId,
          actorId: principal.userId,
          type: "UPDATED",
          title: "Formation task updated",
          metadata: {
            formationPlanId: task.formationStage.formationPlanId,
            formationStageId: task.formationStage.id,
            formationTaskId: task.id,
          },
        },
      });
      return updated;
    });
  },
};
