import { NextResponse } from "next/server";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
import { approveComplianceReviewSchema } from "@/lib/validation/compliance";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, routeContext: RouteContext) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("documents:review")) {
    return NextResponse.json({ error: "Professional review permission required." }, { status: 403 });
  }
  const principal = context.principal;

  const { id } = await routeContext.params;
  const parsed = approveComplianceReviewSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid review note.", issues: parsed.error.flatten() }, { status: 422 });
  }
  const obligation = await prisma.complianceObligation.findFirst({
    where: { id, workspaceId: principal.workspaceId },
    select: {
      id: true,
      status: true,
      professionalReviewRequired: true,
      requiresEvidence: true,
      _count: { select: { evidence: true } },
    },
  });
  if (!obligation) return NextResponse.json({ error: "Compliance obligation not found." }, { status: 404 });
  if (!obligation.professionalReviewRequired) {
    return NextResponse.json({ error: "This obligation does not require professional review." }, { status: 409 });
  }
  if (obligation.status !== "IN_REVIEW") {
    return NextResponse.json({ error: "Obligation must be in review before approval." }, { status: 409 });
  }
  if (obligation.requiresEvidence && obligation._count.evidence === 0) {
    return NextResponse.json({ error: "Attach required evidence before approving review." }, { status: 409 });
  }

  const updated = await withAuthorizedWorkspaceTransaction(principal, "documents:review", async (transaction) => {
    const result = await transaction.complianceObligation.update({
      where: { id: obligation.id },
      data: { professionalReviewCompleted: true, status: "COMPLIANT", completedAt: new Date() },
    });
    await transaction.complianceActivity.create({
      data: {
        obligationId: obligation.id,
        action: "REVIEW_APPROVED",
        actorUserId: principal.userId,
        note: parsed.data.note,
      },
    });
    return result;
  });

  return NextResponse.json({ data: updated });
}