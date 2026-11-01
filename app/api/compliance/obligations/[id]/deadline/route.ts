import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { complianceDeadlineChangeSchema } from "@/lib/validation/compliance-deadline";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, routeContext: RouteContext) {
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
  const parsed = complianceDeadlineChangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid deadline change.", issues: parsed.error.flatten() }, { status: 422 });
  }

  const principal = context.principal;
  const { id } = await routeContext.params;
  const input = parsed.data;
  const hasExplicitSource = Object.prototype.hasOwnProperty.call(input, "sourceRuleVersionId");
  try {
    const result = await withAuthorizedWorkspaceTransaction(principal, "compliance:write", async (transaction) => {
      const obligation = await transaction.complianceObligation.findFirst({
        where: {
          id,
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
        },
        select: {
          id: true,
          jurisdictionId: true,
          dueAt: true,
          sourceRuleVersionId: true,
        },
      });
      if (!obligation) throw new Error("COMPLIANCE_OBLIGATION_NOT_FOUND");

      const nextSourceVersionId = hasExplicitSource
        ? (input.sourceRuleVersionId ?? null)
        : obligation.sourceRuleVersionId;

      if (nextSourceVersionId) {
        const version = await transaction.complianceRuleVersion.findFirst({
          where: {
            id: nextSourceVersionId,
            workspaceId: principal.workspaceId,
            rule: {
              organizationId: principal.organizationId,
              workspaceId: principal.workspaceId,
            },
          },
          select: {
            id: true,
            jurisdictionId: true,
            reviewState: true,
          },
        });
        if (!version) throw new Error("COMPLIANCE_RULE_VERSION_NOT_FOUND");
        if (version.reviewState !== "VERIFIED") throw new Error("COMPLIANCE_RULE_VERSION_NOT_VERIFIED");
        if (obligation.jurisdictionId && version.jurisdictionId !== obligation.jurisdictionId) {
          throw new Error("COMPLIANCE_RULE_JURISDICTION_MISMATCH");
        }
      }

      const latest = await transaction.complianceDeadlineSnapshot.aggregate({
        where: { obligationId: obligation.id, workspaceId: principal.workspaceId },
        _max: { sequence: true },
      });
      const sequence = (latest._max.sequence ?? 0) + 1;
      const facts = JSON.parse(JSON.stringify(input.assessmentFacts)) as Prisma.InputJsonValue;
      const snapshot = await transaction.complianceDeadlineSnapshot.create({
        data: {
          obligationId: obligation.id,
          workspaceId: principal.workspaceId,
          sequence,
          previousDueAt: obligation.dueAt,
          dueAt: input.dueAt,
          reason: input.reason,
          sourceRuleVersionId: nextSourceVersionId,
          assessmentState: "UNKNOWN",
          assessmentFacts: {
            provenance: "USER_PROVIDED",
            assessmentState: "UNKNOWN",
            suppliedFacts: facts,
            note: "This endpoint records a manual deadline change; it does not calculate legal applicability or derive statutory deadlines.",
          },
          actorUserId: principal.userId,
        },
      });

      const changed = await transaction.complianceObligation.updateMany({
        where: {
          id: obligation.id,
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          dueAt: obligation.dueAt,
          sourceRuleVersionId: obligation.sourceRuleVersionId,
        },
        data: {
          dueAt: input.dueAt,
          sourceRuleVersionId: nextSourceVersionId,
        },
      });
      if (changed.count !== 1) throw new Error("COMPLIANCE_DEADLINE_CONFLICT");

      await transaction.complianceActivity.create({
        data: {
          obligationId: obligation.id,
          action: "DEADLINE_CHANGED",
          actorUserId: principal.userId,
          note: input.reason,
          metadata: {
            snapshotId: snapshot.id,
            sequence,
            previousDueAt: obligation.dueAt?.toISOString() ?? null,
            dueAt: input.dueAt?.toISOString() ?? null,
            sourceRuleVersionId: nextSourceVersionId,
            assessmentState: "UNKNOWN",
          },
        },
      });

      return { snapshot, dueAt: input.dueAt };
    });

    return NextResponse.json({ data: result.snapshot, currentDueAt: result.dueAt });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_OBLIGATION_NOT_FOUND") {
      return NextResponse.json({ error: "Compliance obligation not found in the active workspace." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_RULE_VERSION_NOT_FOUND") {
      return NextResponse.json({ error: "The selected rule version is not in the active workspace." }, { status: 422 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_RULE_VERSION_NOT_VERIFIED") {
      return NextResponse.json({ error: "Only an independently verified rule version can be attached as a deadline source." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_RULE_JURISDICTION_MISMATCH") {
      return NextResponse.json({ error: "The selected rule version does not match this obligation's jurisdiction." }, { status: 422 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_DEADLINE_CONFLICT") {
      return NextResponse.json({ error: "The obligation deadline changed concurrently. Refresh and submit again with a reason." }, { status: 409 });
    }
    if (typeof error === "object" && error !== null && "code" in error &&
      ["P2002", "P2034"].includes(String((error as { code?: unknown }).code))) {
      return NextResponse.json({ error: "A concurrent deadline change occurred. Refresh and retry if appropriate." }, { status: 409 });
    }
    console.error("Compliance deadline update failed.");
    return NextResponse.json({ error: "Unable to record the compliance deadline change." }, { status: 500 });
  }
}
