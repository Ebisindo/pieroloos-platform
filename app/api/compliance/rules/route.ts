import { NextResponse } from "next/server";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { complianceRuleDraftSchema } from "@/lib/validation/compliance-rule-api";

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("compliance:read")) {
    return NextResponse.json({ error: "Compliance access denied." }, { status: 403 });
  }

  const principal = context.principal;
  try {
    const rules = await withAuthorizedWorkspaceTransaction(principal, "compliance:read", (transaction) =>
      transaction.complianceRule.findMany({
        where: { organizationId: principal.organizationId, workspaceId: principal.workspaceId },
        include: { versions: { orderBy: { version: "desc" }, take: 1 } },
        orderBy: [{ active: "desc" }, { ruleKey: "asc" }],
      }),
    );
    return NextResponse.json({
      data: rules,
      notice: rules.length
        ? "Rules are evidence leads, not legal conclusions. Confirm each version against its official source."
        : "No rules are recorded in this workspace. An empty registry does not mean no obligations exist.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and retry." }, { status: 409 });
    }
    console.error("Compliance rule listing failed.");
    return NextResponse.json({ error: "Unable to list compliance rules." }, { status: 500 });
  }
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
  const parsed = complianceRuleDraftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid compliance rule draft.", issues: parsed.error.flatten() }, { status: 422 });
  }

  const principal = context.principal;
  const input = parsed.data;
  try {
    const created = await withAuthorizedWorkspaceTransaction(principal, "compliance:write", async (transaction) => {
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
      if (!jurisdiction) throw new Error("COMPLIANCE_RULE_JURISDICTION_NOT_FOUND");

      const now = new Date();
      const rule = await transaction.complianceRule.create({
        data: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          jurisdictionId: jurisdiction.id,
          ruleKey: input.ruleKey,
          currentVersion: 1,
          active: true,
          createdByUserId: principal.userId,
          versions: {
            create: {
              workspaceId: principal.workspaceId,
              version: 1,
              jurisdictionId: jurisdiction.id,
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
          },
        },
        include: { versions: true },
      });
      const version = rule.versions[0];
      await transaction.complianceRuleActivity.create({
        data: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          ruleId: rule.id,
          ruleVersionId: version?.id ?? null,
          actorUserId: principal.userId,
          action: "RULE_DRAFT_CREATED",
          note: "A source-backed rule draft was entered and remains unreviewed.",
          metadata: {
            ruleKey: rule.ruleKey,
            version: 1,
            evidenceClass: "E1",
            reviewState: "UNREVIEWED",
            sourceUrl: input.sourceUrl,
          },
        },
      });
      return rule;
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_RULE_JURISDICTION_NOT_FOUND") {
      return NextResponse.json({ error: "Jurisdiction is not available in the active workspace." }, { status: 422 });
    }
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === "P2002") {
      return NextResponse.json({ error: "A rule with this key already exists in the active workspace." }, { status: 409 });
    }
    console.error("Compliance rule draft creation failed.");
    return NextResponse.json({ error: "Unable to create compliance rule draft." }, { status: 500 });
  }
}
