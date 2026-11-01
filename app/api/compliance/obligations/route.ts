import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
import { createObligationSchema } from "@/lib/validation/compliance";

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("compliance:read")) {
    return NextResponse.json({ error: "Compliance access denied." }, { status: 403 });
  }

  const obligations = await prisma.complianceObligation.findMany({
    where: {
      organizationId: context.principal.organizationId,
      workspaceId: context.principal.workspaceId,
    },
    include: {
      client: { select: { id: true, name: true, organizationName: true } },
      sourceRuleVersion: { select: { id: true, version: true, title: true, sourceUrl: true, reviewState: true } },
      deadlineSnapshots: { orderBy: { sequence: "desc" }, take: 1 },
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });
  return NextResponse.json({ data: obligations });
}

export async function POST(request: Request) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("compliance:write")) {
    return NextResponse.json({ error: "Compliance write permission required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = createObligationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid compliance obligation.", issues: parsed.error.flatten() }, { status: 422 });
  }

  const principal = context.principal;
  const input = parsed.data;
  try {
    const obligation = await withAuthorizedWorkspaceTransaction(principal, "compliance:write", async (transaction) => {
      const client = await transaction.client.findFirst({
        where: {
          id: input.clientId,
          workspaceId: principal.workspaceId,
          OR: [{ organizationId: principal.organizationId }, { organizationId: null }],
        },
        select: { id: true },
      });
      if (!client) throw new Error("COMPLIANCE_CLIENT_NOT_FOUND");

      if (input.businessProfileId) {
        const profile = await transaction.businessProfile.findFirst({
          where: { id: input.businessProfileId, clientId: client.id },
          select: { id: true },
        });
        if (!profile) throw new Error("COMPLIANCE_PROFILE_NOT_FOUND");
      }

      if (input.formationPlanId) {
        const plan = await transaction.formationPlan.findFirst({
          where: {
            id: input.formationPlanId,
            workspaceId: principal.workspaceId,
            clientId: client.id,
          },
          select: { id: true },
        });
        if (!plan) throw new Error("COMPLIANCE_FORMATION_PLAN_NOT_FOUND");
      }

      if (input.jurisdictionId) {
        const jurisdiction = await transaction.jurisdiction.findFirst({
          where: {
            id: input.jurisdictionId,
            OR: [
              {
                workspaceId: principal.workspaceId,
                OR: [{ organizationId: principal.organizationId }, { organizationId: null }],
              },
              { workspaceId: null, organizationId: null },
            ],
          },
          select: { id: true },
        });
        if (!jurisdiction) throw new Error("COMPLIANCE_JURISDICTION_NOT_FOUND");
      }

      const created = await transaction.complianceObligation.create({
        data: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          clientId: client.id,
          businessProfileId: input.businessProfileId,
          formationPlanId: input.formationPlanId,
          jurisdictionId: input.jurisdictionId,
          title: input.title,
          description: input.description,
          type: input.type,
          dueAt: input.dueAt,
          ownerUserId: principal.userId,
          requiresEvidence: input.requiresEvidence,
          professionalReviewRequired: input.professionalReviewRequired,
          sourceRuleVersionId: null,
        },
      });

      await transaction.complianceDeadlineSnapshot.create({
        data: {
          obligationId: created.id,
          workspaceId: principal.workspaceId,
          sequence: 1,
          previousDueAt: null,
          dueAt: created.dueAt,
          reason: created.dueAt
            ? "Initial deadline supplied at obligation creation"
            : "No deadline was established at obligation creation",
          sourceRuleVersionId: null,
          assessmentState: "UNKNOWN",
          assessmentFacts: {
            provenance: "MANUAL_ENTRY",
            assessmentState: "UNKNOWN",
            deadlineOrigin: created.dueAt ? "USER_SUPPLIED" : "NOT_ESTABLISHED",
            statutoryApplicabilityCalculated: false,
          } as Prisma.InputJsonValue,
          actorUserId: principal.userId,
        },
      });

      await transaction.complianceActivity.create({
        data: {
          obligationId: created.id,
          action: "CREATED",
          actorUserId: principal.userId,
          note: "Compliance obligation created; statutory applicability remains unassessed unless backed by a reviewed rule version.",
          metadata: {
            sourceRuleVersionId: null,
            assessmentState: "UNKNOWN",
            deadlineSnapshotSequence: 1,
          },
        },
      });
      return created;
    });

    return NextResponse.json({ data: obligation }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_CLIENT_NOT_FOUND") {
      return NextResponse.json({ error: "Client not found in the active workspace." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_PROFILE_NOT_FOUND") {
      return NextResponse.json({ error: "Business profile does not belong to this client." }, { status: 422 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_FORMATION_PLAN_NOT_FOUND") {
      return NextResponse.json({ error: "Formation plan not found for this client." }, { status: 422 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_JURISDICTION_NOT_FOUND") {
      return NextResponse.json({ error: "Jurisdiction is not available in this workspace." }, { status: 422 });
    }
    if (typeof error === "object" && error !== null && "code" in error &&
      ["P2002", "P2034"].includes(String((error as { code?: unknown }).code))) {
      return NextResponse.json({ error: "A concurrent compliance update occurred. Refresh and retry." }, { status: 409 });
    }
    console.error("Compliance obligation creation failed.");
    return NextResponse.json({ error: "Unable to create compliance obligation." }, { status: 500 });
  }
}
