import { NextResponse } from "next/server";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { prisma } from "@/lib/db/prisma";
import { createMarketEntrySchema } from "@/lib/validation/market-entry";

function readCandidateIds(value: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) && parsed.every((id) => typeof id === "string") ? parsed : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("jurisdictions:read")) {
    return NextResponse.json({ error: "Market-entry access denied." }, { status: 403 });
  }

  const plans = await prisma.marketEntryPlan.findMany({
    where: { workspaceId: context.principal.workspaceId },
    include: {
      businessProfile: {
        select: {
          businessName: true,
          client: { select: { name: true, organizationName: true, firstName: true, lastName: true } },
        },
      },
      targetJurisdiction: { select: { id: true, name: true, country: true, countryCode: true } },
      formationPlan: { select: { id: true, status: true } },
      readinessAssessments: {
        orderBy: { assessedAt: "desc" },
        take: 1,
        select: { id: true, status: true, planVersion: true, resultJson: true, assessedAt: true },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return NextResponse.json({ data: plans });
}

export async function POST(request: Request) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const principal = context.principal;
  if (!principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!principal.permissions.includes("jurisdictions:write")) {
    return NextResponse.json({ error: "Market-entry management permission required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = createMarketEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid market-entry pathway.", issues: parsed.error.flatten() }, { status: 422 });
  }

  const comparison = await prisma.jurisdictionComparison.findFirst({
    where: { id: parsed.data.comparisonSnapshotId, workspaceId: principal.workspaceId },
    select: { id: true, businessProfileId: true, jurisdictionIdsJson: true },
  });
  if (!comparison?.businessProfileId) {
    return NextResponse.json({ error: "A saved comparison linked to a business profile is required." }, { status: 404 });
  }

  const candidateIds = readCandidateIds(comparison.jurisdictionIdsJson);
  if (!candidateIds) {
    return NextResponse.json({ error: "The saved comparison contains invalid jurisdiction data." }, { status: 422 });
  }
  if (!candidateIds.includes(parsed.data.targetJurisdictionId)) {
    return NextResponse.json({ error: "The target jurisdiction was not included in the saved comparison." }, { status: 422 });
  }

  const profile = await prisma.businessProfile.findFirst({
    where: { id: comparison.businessProfileId, client: { workspaceId: principal.workspaceId } },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Business profile not found in this workspace." }, { status: 404 });

  const jurisdiction = await prisma.jurisdiction.findFirst({
    where: {
      id: parsed.data.targetJurisdictionId,
      OR: [{ workspaceId: principal.workspaceId }, { workspaceId: null }],
    },
    select: { id: true },
  });
  if (!jurisdiction) return NextResponse.json({ error: "Target jurisdiction is not available." }, { status: 404 });

  if (parsed.data.formationPlanId) {
    const formationPlan = await prisma.formationPlan.findFirst({
      where: {
        id: parsed.data.formationPlanId,
        workspaceId: principal.workspaceId,
        businessProfileId: profile.id,
        jurisdictionId: jurisdiction.id,
      },
      select: { id: true },
    });
    if (!formationPlan) {
      return NextResponse.json({ error: "Formation plan must match this profile and target jurisdiction." }, { status: 422 });
    }
  }

  const plan = await withAuthorizedWorkspaceTransaction(principal, "jurisdictions:write", async (transaction) => {
    const existingDecision = await transaction.workingJurisdictionDecision.findFirst({
      where: {
        workspaceId: principal.workspaceId,
        businessProfileId: profile.id,
        comparisonSnapshotId: comparison.id,
        jurisdictionId: jurisdiction.id,
      },
      select: { id: true },
    });
    const decisionId = existingDecision?.id ?? `decision-${crypto.randomUUID()}`;
    if (!existingDecision) {
      await transaction.workingJurisdictionDecision.create({
        data: {
          id: decisionId,
          workspaceId: principal.workspaceId,
          businessProfileId: profile.id,
          comparisonSnapshotId: comparison.id,
          jurisdictionId: jurisdiction.id,
          rationale: parsed.data.rationale,
          decidedByUserId: principal.userId,
          professionalReviewRequired: true,
          professionalReviewCompleted: false,
        },
      });
    }
    const created = await transaction.marketEntryPlan.create({
      data: {
        organizationId: principal.organizationId,
        workspaceId: principal.workspaceId,
        businessProfileId: profile.id,
        comparisonSnapshotId: comparison.id,
        targetJurisdictionId: jurisdiction.id,
        formationPlanId: parsed.data.formationPlanId,
        workingJurisdictionDecisionId: decisionId,
        rationale: parsed.data.rationale,
        createdByUserId: principal.userId,
      },
    });
    await transaction.marketEntryAuditEvent.create({
      data: {
        marketEntryPlanId: created.id,
        workspaceId: principal.workspaceId,
        actorUserId: principal.userId,
        eventType: "MARKET_ENTRY_CREATED",
        details: {
          comparisonSnapshotId: comparison.id,
          targetJurisdictionId: jurisdiction.id,
          formationPlanId: parsed.data.formationPlanId ?? null,
        },
      },
    });
    return created;
  });

  return NextResponse.json({ data: plan }, { status: 201 });
}
