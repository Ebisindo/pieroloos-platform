import { NextResponse } from "next/server";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
import { complianceRuleVersionDraftSchema } from "@/lib/validation/compliance-rule-api";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, routeContext: RouteContext) {
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
  const parsed = complianceRuleVersionDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid compliance rule version draft.", issues: parsed.error.flatten() }, { status: 422 });
  }

  const principal = context.principal;
  const { id } = await routeContext.params;
  const input = parsed.data;
  try {
    const version = await withAuthorizedWorkspaceTransaction(principal, "compliance:write", async (transaction) => {
      const rule = await transaction.complianceRule.findFirst({
        where: {
          id,
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          active: true,
        },
        select: { id: true, jurisdictionId: true, currentVersion: true, ruleKey: true },
      });
      if (!rule) throw new Error("COMPLIANCE_RULE_NOT_FOUND");

      const nextVersion = rule.currentVersion + 1;
      const previous = await transaction.complianceRuleVersion.findFirst({
        where: { ruleId: rule.id, workspaceId: principal.workspaceId, version: rule.currentVersion },
        select: { id: true, version: true, reviewState: true, supersededByVersion: true },
      });
      if (!previous || previous.supersededByVersion !== null) throw new Error("COMPLIANCE_RULE_VERSION_CONFLICT");
      const now = new Date();
      const created = await transaction.complianceRuleVersion.create({
        data: {
          ruleId: rule.id,
          workspaceId: principal.workspaceId,
          version: nextVersion,
          jurisdictionId: rule.jurisdictionId,
          title: input.title,
          description: input.description ?? null,
          obligationType: input.type,
          sourceAuthority: input.sourceAuthority,
          sourceUrl: input.sourceUrl,
          sourceRetrievedAt: null,
          publicationDate: input.publicationDate ?? null,
          effectiveFrom: input.effectiveFrom,
          effectiveThrough: input.effectiveThrough ?? null,
          evidenceClass: "E1",
          applicability: input.applicability,
          relativeDueDays: input.relativeDueDays ?? null,
          requiresEvidence: input.requiresEvidence,
          professionalReviewRequired: true,
          reviewState: "UNREVIEWED",
          reviewedByUserId: null,
          reviewedAt: null,
          reviewNote: null,
          createdByUserId: principal.userId,
        },
      });
      const superseded = await transaction.complianceRuleVersion.updateMany({
        where: {
          id: previous.id,
          ruleId: rule.id,
          workspaceId: principal.workspaceId,
          version: rule.currentVersion,
          reviewState: previous.reviewState,
          supersededByVersion: null,
        },
        data: { reviewState: "SUPERSEDED", supersededByVersion: nextVersion },
      });
      if (superseded.count !== 1) throw new Error("COMPLIANCE_RULE_VERSION_CONFLICT");

      const pointer = await transaction.complianceRule.updateMany({
        where: {
          id: rule.id,
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          currentVersion: rule.currentVersion,
        },
        data: { currentVersion: nextVersion },
      });
      if (pointer.count !== 1) throw new Error("COMPLIANCE_RULE_VERSION_CONFLICT");

      await transaction.complianceRuleActivity.create({
        data: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          ruleId: rule.id,
          ruleVersionId: created.id,
          actorUserId: principal.userId,
          action: "RULE_VERSION_DRAFT_CREATED",
          note: "A new immutable rule-content version was entered and remains unreviewed.",
          metadata: {
            ruleKey: rule.ruleKey,
            previousVersion: rule.currentVersion,
            previousReviewState: previous.reviewState,
            previousSupersededByVersion: nextVersion,
            version: nextVersion,
            evidenceClass: "E1",
            reviewState: "UNREVIEWED",
            sourceUrl: input.sourceUrl,
          },
        },
      });
      return created;
    });
    return NextResponse.json({ data: version }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_RULE_NOT_FOUND") {
      return NextResponse.json({ error: "Compliance rule not found in the active workspace." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_RULE_VERSION_CONFLICT") {
      return NextResponse.json({ error: "A concurrent or inconsistent rule-version state was detected. Refresh before creating the next version." }, { status: 409 });
    }
    if (typeof error === "object" && error !== null && "code" in error &&
      ["P2002", "P2034"].includes(String((error as { code?: unknown }).code))) {
      return NextResponse.json({ error: "A concurrent rule-version change occurred. Retry against the latest version." }, { status: 409 });
    }
    console.error("Compliance rule version creation failed.");
    return NextResponse.json({ error: "Unable to create compliance rule version." }, { status: 500 });
  }
}
