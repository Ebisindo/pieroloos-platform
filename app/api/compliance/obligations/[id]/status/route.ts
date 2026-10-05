import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
import { updateComplianceStatusSchema } from "@/lib/validation/compliance";

export async function PATCH(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("compliance:write")) {
    return NextResponse.json({ error: "Compliance write permission required." }, { status: 403 });
  }
  const principal = context.principal;

  const { id } = await routeContext.params;
  const parsed = updateComplianceStatusSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid compliance status.", issues: parsed.error.flatten() }, { status: 422 });
  }
  if (parsed.data.status === "OVERDUE") {
    return NextResponse.json({ error: "Overdue status is derived from the due date." }, { status: 422 });
  }

  const existing = await prisma.complianceObligation.findFirst({
    where: { id, workspaceId: principal.workspaceId },
    select: {
      id: true,
      status: true,
      requiresEvidence: true,
      professionalReviewRequired: true,
      professionalReviewCompleted: true,
      evidence: {
        where: {
          reviewStatus: "VERIFIED",
          OR: [{ validThrough: null }, { validThrough: { gte: new Date() } }],
        },
        select: { id: true },
      },
    },
  });
  if (!existing) return NextResponse.json({ error: "Compliance obligation not found." }, { status: 404 });
  if (parsed.data.status === "COMPLIANT" && existing.requiresEvidence && existing.evidence.length === 0) {
    return NextResponse.json({ error: "A current, professionally verified evidence record is required before marking this obligation compliant." }, { status: 409 });
  }
  if (parsed.data.status === "COMPLIANT" && existing.professionalReviewRequired && !existing.professionalReviewCompleted) {
    return NextResponse.json({ error: "Professional review must be approved before marking this obligation compliant." }, { status: 409 });
  }

  const terminal = ["COMPLETE", "COMPLETED", "COMPLIANT", "WAIVED", "NOT_APPLICABLE"].includes(parsed.data.status);
  const obligation = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.complianceObligation.update({
      where: { id: existing.id },
      data: {
        status: parsed.data.status,
        completedAt: terminal ? new Date() : null,
      },
    });
    await transaction.complianceActivity.create({
      data: {
        obligationId: existing.id,
        action: "STATUS_CHANGED",
        actorUserId: principal.userId,
        note: parsed.data.note,
        metadata: { from: existing.status, to: parsed.data.status },
      },
    });
    return updated;
  });

  return NextResponse.json({ data: obligation });
}
