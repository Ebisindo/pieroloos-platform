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
  const obligation = await prisma.complianceObligation.findFirst({
    where: { id, workspaceId: context.principal.workspaceId },
    select: { id: true },
  });
  if (!obligation) return NextResponse.json({ error: "Compliance obligation not found." }, { status: 404 });

  const existing = await prisma.complianceEvidence.findFirst({
    where: { id: evidenceId, obligationId: obligation.id },
    select: { id: true, reviewStatus: true },
  });
  if (!existing) return NextResponse.json({ error: "Evidence record not found." }, { status: 404 });

  const reviewedAt = new Date();
  const result = await withAuthorizedWorkspaceTransaction(context.principal, "documents:review", async (transaction) => {
    const updated = await transaction.complianceEvidence.updateMany({
      where: { id: existing.id, obligationId: obligation.id },
      data: {
        reviewStatus: parsed.data.reviewStatus,
        reviewNote: parsed.data.note,
        reviewedByUserId: context.principal!.userId,
        reviewedAt,
      },
    });
    if (!updated.count) return null;
    const evidence = await transaction.complianceEvidence.findFirst({
      where: { id: existing.id, obligationId: obligation.id },
    });
    if (!evidence) return null;
    await transaction.complianceActivity.create({
      data: {
        obligationId: obligation.id,
        action: "EVIDENCE_REVIEWED",
        actorUserId: context.principal!.userId,
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
  if (!result) return NextResponse.json({ error: "Evidence record changed. Refresh and retry." }, { status: 409 });

  return NextResponse.json({ data: result });
}
