import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
import { buildComplianceControlSnapshot } from "@/lib/domain/compliance-control";

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("compliance:read")) {
    return NextResponse.json({ error: "Compliance access denied." }, { status: 403 });
  }

  const obligations = await prisma.complianceObligation.findMany({
    where: { workspaceId: context.principal.workspaceId },
    select: {
      id: true,
      clientId: true,
      title: true,
      status: true,
      dueAt: true,
      requiresEvidence: true,
      professionalReviewRequired: true,
      escalationLevel: true,
    },
  });
  const snapshot = buildComplianceControlSnapshot(obligations);

  return NextResponse.json({
    data: {
      portfolioStatus: snapshot.portfolioStatus,
      progress: snapshot.progressPercent,
      counts: {
        total: snapshot.totals.obligations,
        notStarted: obligations.filter((item) => item.status === "NOT_STARTED").length,
        inProgress: obligations.filter((item) => item.status === "IN_PROGRESS").length,
        inReview: snapshot.totals.awaitingReview,
        overdue: snapshot.totals.overdue,
        blocked: snapshot.totals.blocked,
        compliant: snapshot.totals.compliant,
      },
    },
  });
}
