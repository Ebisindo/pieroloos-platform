import { NextResponse } from "next/server";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { updateComplianceStatusSchema } from "@/lib/validation/compliance";

export async function PATCH(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });

  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("compliance:write")) {
    return NextResponse.json({ error: "Compliance write permission required." }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = updateComplianceStatusSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid compliance status.", issues: parsed.error.flatten() }, { status: 422 });
  if (parsed.data.status === "OVERDUE") {
    return NextResponse.json({ error: "Overdue status is derived from the due date." }, { status: 422 });
  }

  const principal = context.principal;
  const { id } = await routeContext.params;
  const terminal = ["COMPLETE", "COMPLETED", "COMPLIANT", "WAIVED", "NOT_APPLICABLE"].includes(parsed.data.status);
  const now = new Date();

  try {
    const obligation = await withAuthorizedWorkspaceTransaction(principal, "compliance:write", async (transaction) => {
      // Re-read authorization scope, state and evidence under the same transaction that writes the transition.
      const existing = await transaction.complianceObligation.findFirst({
        where: { id, organizationId: principal.organizationId, workspaceId: principal.workspaceId },
        select: {
          id: true, status: true, completedAt: true, requiresEvidence: true,
          professionalReviewRequired: true, professionalReviewCompleted: true,
          evidence: {
            where: {
              reviewStatus: "VERIFIED",
              OR: [{ validThrough: null }, { validThrough: { gte: now } }],
              document: {
                workspaceId: principal.workspaceId,
                status: "AVAILABLE",
                scanStatus: "CLEAN",
                deletedAt: null,
              },
            },
            select: { id: true },
          },
        },
      });
      if (!existing) throw new Error("COMPLIANCE_OBLIGATION_NOT_FOUND");
      if (parsed.data.expectedStatus && existing.status !== parsed.data.expectedStatus) throw new Error("COMPLIANCE_STATUS_CONFLICT");
      if (parsed.data.status === "COMPLIANT" && existing.requiresEvidence && existing.evidence.length === 0) {
        throw new Error("COMPLIANCE_EVIDENCE_REQUIRED");
      }
      if (parsed.data.status === "COMPLIANT" && existing.professionalReviewRequired && !existing.professionalReviewCompleted) {
        throw new Error("COMPLIANCE_PROFESSIONAL_REVIEW_REQUIRED");
      }

      // Keep the first completedAt timestamp as history. Each later transition records its own timestamp in the audit entry.
      const completedAt = terminal ? (existing.completedAt ?? now) : existing.completedAt;
      const changed = await transaction.complianceObligation.updateMany({
        where: {
          id: existing.id,
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          status: existing.status,
          completedAt: existing.completedAt,
        },
        data: { status: parsed.data.status, completedAt },
      });
      if (changed.count !== 1) throw new Error("COMPLIANCE_STATUS_CONFLICT");

      const latestHistory = await transaction.complianceStatusSnapshot.aggregate({
        where: { obligationId: existing.id, workspaceId: principal.workspaceId },
        _max: { sequence: true },
      });
      await transaction.complianceStatusSnapshot.create({
        data: {
          obligationId: existing.id,
          workspaceId: principal.workspaceId,
          sequence: (latestHistory._max.sequence ?? 0) + 1,
          previousStatus: existing.status,
          currentStatus: parsed.data.status,
          completedAtBefore: existing.completedAt,
          completedAtAfter: completedAt,
          reason: parsed.data.note ?? null,
          actorUserId: principal.userId,
          occurredAt: now,
        },
      });

      await transaction.complianceActivity.create({
        data: {
          obligationId: existing.id,
          action: "STATUS_CHANGED",
          actorUserId: principal.userId,
          note: parsed.data.note,
          metadata: {
            from: existing.status,
            to: parsed.data.status,
            transitionedAt: now.toISOString(),
            completedAtBefore: existing.completedAt?.toISOString() ?? null,
            completedAtAfter: completedAt?.toISOString() ?? null,
            expectedStatus: parsed.data.expectedStatus ?? null,
          },
        },
      });
      return transaction.complianceObligation.findFirstOrThrow({
        where: { id: existing.id, organizationId: principal.organizationId, workspaceId: principal.workspaceId },
      });
    });
    return NextResponse.json({ data: obligation });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_OBLIGATION_NOT_FOUND") {
      return NextResponse.json({ error: "Compliance obligation not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_STATUS_CONFLICT") {
      return NextResponse.json({ error: "The obligation status changed concurrently. Refresh and retry with the current status." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_EVIDENCE_REQUIRED") {
      return NextResponse.json({ error: "A current, professionally verified evidence record is required before marking this obligation compliant." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_PROFESSIONAL_REVIEW_REQUIRED") {
      return NextResponse.json({ error: "Professional review must be approved before marking this obligation compliant." }, { status: 409 });
    }
    if (typeof error === "object" && error !== null && "code" in error && ["P2002", "P2034"].includes(String((error as { code?: unknown }).code))) {
      return NextResponse.json({ error: "A concurrent compliance update occurred. Refresh and retry." }, { status: 409 });
    }
    console.error("Compliance status transition failed.");
    return NextResponse.json({ error: "Unable to update compliance status." }, { status: 500 });
  }
}
