import { NextResponse } from "next/server";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { prisma } from "@/lib/db/prisma";
import { reviewComplianceEvidenceSchema } from "@/lib/validation/compliance";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; evidenceId: string }> },
) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("documents:review")) {
    return NextResponse.json({ error: "Professional review permission required." }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = reviewComplianceEvidenceSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "A review decision and note are required." }, { status: 422 });

  const { id, evidenceId } = await params;
  const principal = context.principal;
  const obligation = await prisma.complianceObligation.findFirst({
    where: { id, organizationId: principal.organizationId, workspaceId: principal.workspaceId },
    select: { id: true },
  });
  if (!obligation) return NextResponse.json({ error: "Compliance obligation not found." }, { status: 404 });
  const existing = await prisma.complianceEvidence.findFirst({
    where: {
      id: evidenceId,
      obligationId: obligation.id,
      workspaceId: principal.workspaceId,
      document: { workspaceId: principal.workspaceId, status: "AVAILABLE", scanStatus: "CLEAN", deletedAt: null },
    },
    select: { id: true, reviewStatus: true },
  });
  if (!existing) return NextResponse.json({ error: "Evidence record not found." }, { status: 404 });

  const reviewedAt = new Date();
  try {
    const result = await withAuthorizedWorkspaceTransaction(principal, "documents:review", async (transaction) => {
      // Repeat resource scope and status checks after authorization inside the write transaction.
      const currentObligation = await transaction.complianceObligation.findFirst({
        where: { id: obligation.id, organizationId: principal.organizationId, workspaceId: principal.workspaceId },
        select: { id: true },
      });
      if (!currentObligation) return null;

      const currentEvidence = await transaction.complianceEvidence.findFirst({
        where: {
          id: existing.id,
          obligationId: currentObligation.id,
          workspaceId: principal.workspaceId,
          reviewStatus: existing.reviewStatus,
          document: { workspaceId: principal.workspaceId, status: "AVAILABLE", scanStatus: "CLEAN", deletedAt: null },
        },
        select: { id: true, reviewStatus: true },
      });
      if (!currentEvidence) return null;
      if (currentEvidence.reviewStatus === "REVOKED") throw new Error("COMPLIANCE_EVIDENCE_REVOKED");

      const updated = await transaction.complianceEvidence.updateMany({
        where: {
          id: currentEvidence.id,
          obligationId: currentObligation.id,
          workspaceId: principal.workspaceId,
          reviewStatus: currentEvidence.reviewStatus,
        },
        data: {
          reviewStatus: parsed.data.reviewStatus,
          reviewNote: parsed.data.note,
          reviewedByUserId: principal.userId,
          reviewedAt,
        },
      });
      if (updated.count !== 1) return null;
      const evidence = await transaction.complianceEvidence.findFirst({
        where: { id: currentEvidence.id, obligationId: currentObligation.id, workspaceId: principal.workspaceId },
      });
      if (!evidence) return null;

      await transaction.complianceActivity.create({
        data: {
          obligationId: currentObligation.id,
          action: "EVIDENCE_REVIEWED",
          actorUserId: principal.userId,
          note: parsed.data.note,
          metadata: {
            evidenceId: evidence.id,
            fromReviewStatus: currentEvidence.reviewStatus,
            toReviewStatus: parsed.data.reviewStatus,
            reviewedAt: reviewedAt.toISOString(),
          },
        },
      });
      return evidence;
    });
    if (!result) return NextResponse.json({ error: "Evidence or obligation changed concurrently. Refresh and retry." }, { status: 409 });
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof Error && error.message === "COMPLIANCE_EVIDENCE_REVOKED") {
      return NextResponse.json({ error: "Revoked evidence is immutable. Attach a replacement evidence record if the claim has been corrected." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    if (typeof error === "object" && error !== null && "code" in error &&
        ["P2002", "P2034"].includes(String((error as { code?: unknown }).code))) {
      return NextResponse.json({ error: "Concurrent evidence review conflicted. Refresh and retry." }, { status: 409 });
    }
    console.error("Compliance evidence review failed.");
    return NextResponse.json({ error: "Unable to record evidence review." }, { status: 500 });
  }
}
