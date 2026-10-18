import { NextResponse } from "next/server";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { reviewComplianceEvidenceSchema } from "@/lib/validation/compliance";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; evidenceId: string }> },
) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("documents:review")) {
    return NextResponse.json({ error: "Professional review permission required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = reviewComplianceEvidenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A review decision and note are required." }, { status: 422 });
  }

  const { id, evidenceId } = await params;
  const principal = context.principal;
  try {
    const result = await withAuthorizedWorkspaceTransaction(principal, "documents:review", async (transaction) => {
      const obligation = await transaction.complianceObligation.findFirst({
        where: {
          id,
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
        },
        select: { id: true },
      });
      if (!obligation) throw new Error("COMPLIANCE_OBLIGATION_NOT_FOUND");

      const existing = await transaction.complianceEvidence.findFirst({
        where: {
          id: evidenceId,
          obligationId: obligation.id,
          workspaceId: principal.workspaceId,
        },
        select: { id: true, reviewStatus: true },
      });
      if (!existing) throw new Error("COMPLIANCE_EVIDENCE_NOT_FOUND");

      // Compare-and-set the state read in this transaction. If another reviewer
      // changes it concurrently, no update is recorded and the caller must reload.
      const updated = await transaction.complianceEvidence.updateMany({
        where: {
          id: existing.id,
          obligationId: obligation.id,
          workspaceId: principal.workspaceId,
          reviewStatus: existing.reviewStatus,
        },
        data: {
          reviewStatus: parsed.data.reviewStatus,
          reviewNote: parsed.data.note,
          reviewedByUserId: principal.userId,
          reviewedAt: new Date(),
        },
      });
      if (!updated.count) throw new Error("COMPLIANCE_EVIDENCE_REVIEW_CONFLICT");

      const evidence = await transaction.complianceEvidence.findFirst({
        where: {
          id: existing.id,
          obligationId: obligation.id,
          workspaceId: principal.workspaceId,
        },
      });
      if (!evidence) throw new Error("COMPLIANCE_EVIDENCE_NOT_FOUND");

      await transaction.complianceActivity.create({
        data: {
          obligationId: obligation.id,
          action: "EVIDENCE_REVIEWED",
          actorUserId: principal.userId,
          note: parsed.data.note,
          metadata: {
            evidenceId: evidence.id,
            fromReviewStatus: existing.reviewStatus,
            toReviewStatus: parsed.data.reviewStatus,
          },
        },
      });
      return evidence;
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_OBLIGATION_NOT_FOUND") {
      return NextResponse.json({ error: "Compliance obligation not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_EVIDENCE_NOT_FOUND") {
      return NextResponse.json({ error: "Evidence record not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_EVIDENCE_REVIEW_CONFLICT") {
      return NextResponse.json({ error: "Evidence review changed concurrently. Refresh and retry." }, { status: 409 });
    }
    console.error("Compliance evidence review failed.", error);
    return NextResponse.json({ error: "Unable to review compliance evidence." }, { status: 500 });
  }
}
