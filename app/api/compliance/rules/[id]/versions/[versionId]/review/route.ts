import { NextResponse } from "next/server";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { complianceRuleReviewSchema } from "@/lib/validation/compliance-rule-api";

type RouteContext = { params: Promise<{ id: string; versionId: string }> };

export async function POST(request: Request, routeContext: RouteContext) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("documents:review")) {
    return NextResponse.json({ error: "Independent evidence-review permission required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = complianceRuleReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid rule review decision.", issues: parsed.error.flatten() }, { status: 422 });
  }

  const principal = context.principal;
  const { id, versionId } = await routeContext.params;
  const input = parsed.data;
  try {
    const reviewed = await withAuthorizedWorkspaceTransaction(principal, "documents:review", async (transaction) => {
      const version = await transaction.complianceRuleVersion.findFirst({
        where: {
          id: versionId,
          ruleId: id,
          workspaceId: principal.workspaceId,
          rule: {
            organizationId: principal.organizationId,
            workspaceId: principal.workspaceId,
          },
        },
        select: {
          id: true,
          ruleId: true,
          version: true,
          reviewState: true,
          createdByUserId: true,
          sourceUrl: true,
          sourceRetrievedAt: true,
          effectiveFrom: true,
          effectiveThrough: true,
        },
      });
      if (!version) throw new Error("COMPLIANCE_RULE_VERSION_NOT_FOUND");
      if (version.createdByUserId === principal.userId) throw new Error("COMPLIANCE_RULE_REVIEW_SELF_APPROVAL");
      if (version.reviewState !== "UNREVIEWED") throw new Error("COMPLIANCE_RULE_VERSION_ALREADY_REVIEWED");

      const reviewedAt = new Date();
      const reviewState = input.decision === "VERIFY" ? "VERIFIED" : "REJECTED";
      const evidenceClass = input.decision === "VERIFY" ? input.evidenceClass : undefined;
      const changed = await transaction.complianceRuleVersion.updateMany({
        where: {
          id: version.id,
          ruleId: id,
          workspaceId: principal.workspaceId,
          reviewState: "UNREVIEWED",
        },
        data: {
          reviewState,
          ...(evidenceClass ? { evidenceClass } : {}),
          reviewedByUserId: principal.userId,
          reviewedAt,
          sourceRetrievedAt: input.decision === "VERIFY" ? reviewedAt : version.sourceRetrievedAt,
          reviewNote: input.reviewNote,
        },
      });
      if (changed.count !== 1) throw new Error("COMPLIANCE_RULE_VERSION_REVIEW_CONFLICT");

      await transaction.complianceRuleActivity.create({
        data: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          ruleId: version.ruleId,
          ruleVersionId: version.id,
          actorUserId: principal.userId,
          action: input.decision === "VERIFY" ? "RULE_VERSION_VERIFIED" : "RULE_VERSION_REJECTED",
          note: input.reviewNote,
          metadata: {
            version: version.version,
            priorReviewState: version.reviewState,
            reviewState,
            evidenceClass: evidenceClass ?? null,
            sourceUrl: version.sourceUrl,
            sourceRetrievedAt: input.decision === "VERIFY" ? reviewedAt.toISOString() : version.sourceRetrievedAt?.toISOString() ?? null,
            effectiveFrom: version.effectiveFrom.toISOString(),
            effectiveThrough: version.effectiveThrough?.toISOString() ?? null,
          },
        },
      });
      return transaction.complianceRuleVersion.findFirstOrThrow({
        where: { id: version.id, ruleId: id, workspaceId: principal.workspaceId },
      });
    });
    return NextResponse.json({ data: reviewed });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_RULE_VERSION_NOT_FOUND") {
      return NextResponse.json({ error: "Rule version not found in the active workspace." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_RULE_REVIEW_SELF_APPROVAL") {
      return NextResponse.json({ error: "The person who entered a rule version cannot review their own version." }, { status: 403 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_RULE_VERSION_ALREADY_REVIEWED") {
      return NextResponse.json({ error: "This rule version has already been reviewed. Create a new version to change its content." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_RULE_VERSION_REVIEW_CONFLICT") {
      return NextResponse.json({ error: "The rule version changed during review. Refresh and inspect its audit history." }, { status: 409 });
    }
    if (typeof error === "object" && error !== null && "code" in error &&
      ["P2002", "P2034"].includes(String((error as { code?: unknown }).code))) {
      return NextResponse.json({ error: "A concurrent review conflict occurred. Refresh and retry if still appropriate." }, { status: 409 });
    }
    console.error("Compliance rule review failed.");
    return NextResponse.json({ error: "Unable to record rule review." }, { status: 500 });
  }
}
