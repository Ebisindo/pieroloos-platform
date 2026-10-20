import { NextResponse } from "next/server";
import type { FormationTask as DomainFormationTask } from "@/lib/domain/formation";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
import { evidenceSatisfied, taskCanComplete, taskDependenciesSatisfied } from "@/lib/domain/formation";
import { formationTaskActionSchema } from "@/lib/validation/formation";

type RouteContext = { params: Promise<{ id: string; taskId: string }> };

export async function PATCH(request: Request, routeContext: RouteContext) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("formation:write")) {
    return NextResponse.json({ error: "Formation write permission required." }, { status: 403 });
  }
  const principal = context.principal;

  const { id, taskId } = await routeContext.params;
  const parsed = formationTaskActionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid task action.", issues: parsed.error.flatten() }, { status: 422 });
  }

  const plan = await prisma.formationPlan.findFirst({
    where: { id, workspaceId: principal.workspaceId },
    include: {
      stages: {
        include: {
          tasks: { include: { evidenceRequirements: true, reviews: true } },
        },
      },
    },
  });
  if (!plan) return NextResponse.json({ error: "Formation plan not found." }, { status: 404 });

  const taskRecord = plan.stages.flatMap((stage) => stage.tasks).find((task) => task.id === taskId);
  if (!taskRecord) return NextResponse.json({ error: "Task not found in this plan." }, { status: 404 });

  const tasks: DomainFormationTask[] = plan.stages.flatMap((stage) => stage.tasks).map((task) => ({
    id: task.id,
    key: task.key,
    title: task.title,
    description: task.description,
    status: task.status as DomainFormationTask["status"],
    order: task.order,
    dependsOnTaskKeys: task.dependsOnTaskKeys,
    evidenceRequirements: task.evidenceRequirements.map((requirement) => ({
      key: requirement.key,
      label: requirement.label,
      required: requirement.required,
      satisfied: requirement.satisfied,
      evidenceId: requirement.evidenceId ?? undefined,
    })),
    requiresProfessionalReview: task.requiresProfessionalReview,
    reviewCompleted: task.reviews.some((review) => review.outcome === "APPROVED"),
  }));
  const task = tasks.find((item) => item.id === taskId)!;
  const allTasks = tasks;

  if (parsed.data.action === "REVIEW_APPROVE" && !principal.permissions.includes("documents:review")) {
    return NextResponse.json({ error: "Professional review permission required." }, { status: 403 });
  }
  if (parsed.data.action === "SATISFY_EVIDENCE" && !principal.permissions.includes("documents:write")) {
    return NextResponse.json({ error: "Document write permission required." }, { status: 403 });
  }

  if (parsed.data.action === "START" && !["PENDING", "READY"].includes(task.status)) {
    return NextResponse.json({ error: "Only pending or ready tasks can be started." }, { status: 409 });
  }
  if (parsed.data.action === "COMPLETE" && ["COMPLETED", "WAIVED"].includes(task.status)) {
    return NextResponse.json({ error: "This task is already complete." }, { status: 409 });
  }
  if (parsed.data.action === "REVIEW_APPROVE" && task.reviewCompleted) {
    return NextResponse.json({ error: "Professional review has already been approved." }, { status: 409 });
  }

  if (parsed.data.action === "START" && !taskDependenciesSatisfied(task, allTasks)) {
    return NextResponse.json({ error: "Complete prerequisite tasks before starting this task." }, { status: 409 });
  }
  if (parsed.data.action === "COMPLETE" && !taskCanComplete(task, allTasks)) {
    return NextResponse.json({ error: "Complete dependencies, required evidence, and professional review before marking this task complete." }, { status: 409 });
  }
  if ((parsed.data.action === "WAIVE" || parsed.data.action === "BLOCK") && !parsed.data.note) {
    return NextResponse.json({ error: "A note is required for this action." }, { status: 422 });
  }
  if (parsed.data.action === "REVIEW_APPROVE" && (
    !task.requiresProfessionalReview
    || !taskDependenciesSatisfied(task, allTasks)
    || !evidenceSatisfied(task)
  )) {
    return NextResponse.json({ error: "This task is not ready for professional review." }, { status: 409 });
  }

  if (parsed.data.action === "SATISFY_EVIDENCE") {
    if (!parsed.data.evidenceRequirementKey || !parsed.data.evidenceId) {
      return NextResponse.json({ error: "Evidence requirement and document are required." }, { status: 422 });
    }
    const requirement = taskRecord.evidenceRequirements.find((item) => item.key === parsed.data.evidenceRequirementKey);
    if (!requirement) return NextResponse.json({ error: "Evidence requirement not found." }, { status: 404 });
    const document = await prisma.document.findFirst({
      where: {
        id: parsed.data.evidenceId,
        workspaceId: principal.workspaceId,
        clientId: plan.clientId,
        status: "AVAILABLE",
        scanStatus: "CLEAN",
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!document) return NextResponse.json({ error: "Document not found for this client and workspace." }, { status: 404 });
  }

  const permission = parsed.data.action === "REVIEW_APPROVE"
    ? "documents:review"
    : parsed.data.action === "SATISFY_EVIDENCE"
      ? "documents:write"
      : "formation:write";
  let updatedTask;
  try {
    updatedTask = await withAuthorizedWorkspaceTransaction(principal, permission, async (transaction) => {
    if (parsed.data.action === "REVIEW_APPROVE") {
      await transaction.formationReview.create({
        data: {
          formationTaskId: taskId,
          reviewerUserId: principal.userId,
          outcome: "APPROVED",
          note: parsed.data.note,
        },
      });
    }

    let updated;
    if (parsed.data.action === "SATISFY_EVIDENCE") {
      const document = await transaction.document.findFirst({
        where: {
          id: parsed.data.evidenceId,
          workspaceId: principal.workspaceId,
          clientId: plan.clientId,
          status: "AVAILABLE",
          scanStatus: "CLEAN",
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!document) throw new Error("DOCUMENT_NOT_READY");
      await transaction.documentAccessEvent.create({
        data: {
          documentId: document.id,
          workspaceId: principal.workspaceId,
          actorUserId: principal.userId,
          action: "EVIDENCE_LINKED",
          metadata: {
            formationPlanId: plan.id,
            taskId,
            evidenceRequirementKey: parsed.data.evidenceRequirementKey,
          },
        },
      });
      updated = await transaction.formationTask.update({
        where: { id: taskId },
        data: {
          evidenceRequirements: {
            update: {
              where: { formationTaskId_key: { formationTaskId: taskId, key: parsed.data.evidenceRequirementKey! } },
              data: { satisfied: true, evidenceId: parsed.data.evidenceId, satisfiedAt: new Date() },
            },
          },
        },
        include: { evidenceRequirements: true, reviews: true },
      });
    } else if (parsed.data.action === "START") {
      updated = await transaction.formationTask.update({ where: { id: taskId }, data: { status: "IN_PROGRESS" }, include: { evidenceRequirements: true, reviews: true } });
    } else if (parsed.data.action === "COMPLETE") {
      updated = await transaction.formationTask.update({
        where: { id: taskId },
        data: { status: "COMPLETED", completionNote: parsed.data.note, completedAt: new Date(), blockingReason: null },
        include: { evidenceRequirements: true, reviews: true },
      });
    } else if (parsed.data.action === "WAIVE") {
      updated = await transaction.formationTask.update({
        where: { id: taskId },
        data: { status: "WAIVED", completionNote: parsed.data.note, completedAt: new Date(), blockingReason: null },
        include: { evidenceRequirements: true, reviews: true },
      });
    } else if (parsed.data.action === "BLOCK") {
      updated = await transaction.formationTask.update({
        where: { id: taskId },
        data: { status: "BLOCKED", blockingReason: parsed.data.note },
        include: { evidenceRequirements: true, reviews: true },
      });
    } else {
      updated = await transaction.formationTask.findUniqueOrThrow({
        where: { id: taskId },
        include: { evidenceRequirements: true, reviews: true },
      });
    }

    await transaction.activity.create({
      data: {
        workspaceId: principal.workspaceId,
        actorId: principal.userId,
        type: parsed.data.action === "COMPLETE" ? "COMPLETED" : "STATUS_CHANGED",
        title: `Formation task ${parsed.data.action.toLowerCase().replaceAll("_", " ")}`,
        summary: taskRecord.title,
        metadata: { planId: plan.id, taskId, action: parsed.data.action },
      },
    });

    const refreshedPlan = await transaction.formationPlan.findUniqueOrThrow({
      where: { id: plan.id },
      include: { stages: { include: { tasks: true } } },
    });
    for (const stage of refreshedPlan.stages) {
      const finished = stage.tasks.every((item) => ["COMPLETED", "WAIVED"].includes(item.status));
      const started = stage.tasks.some((item) => !["PENDING", "READY"].includes(item.status));
      await transaction.formationStage.update({
        where: { id: stage.id },
        data: { status: finished ? "COMPLETED" : started ? "IN_PROGRESS" : "PENDING" },
      });
    }
    const flattenedTasks = refreshedPlan.stages.flatMap((stage) => stage.tasks);
    const planFinished = flattenedTasks.every((item) => ["COMPLETED", "WAIVED"].includes(item.status));
    const planStarted = flattenedTasks.some((item) => !["PENDING", "READY"].includes(item.status));
    await transaction.formationPlan.update({
      where: { id: plan.id },
      data: { status: planFinished ? "COMPLETED" : planStarted ? "IN_PROGRESS" : "DRAFT" },
    });

    return updated;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "DOCUMENT_NOT_READY") {
      return NextResponse.json({ error: "Only security-scanned documents can satisfy evidence requirements." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ data: updatedTask });
}