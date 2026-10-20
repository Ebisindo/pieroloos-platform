import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";

const reviewSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"]),
  note: z.string().trim().min(4).max(3000),
  expectedVersion: z.number().int().positive(),
}).strict();

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, routeContext: RouteContext) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const context = await getWorkspaceContext();
  if (!context.userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!context.principal) {
    return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  }
  if (!context.principal.permissions.includes("formation:write")) {
    return NextResponse.json({ error: "Business formation write permission required." }, { status: 403 });
  }
  if (!["owner", "admin", "advisor"].includes(context.principal.role)) {
    return NextResponse.json({ error: "Advisor-level review permission required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid review decision and rationale are required." }, { status: 422 });
  }

  const { id } = await routeContext.params;
  const principal = context.principal;
  try {
    const result = await withAuthorizedWorkspaceTransaction(
      principal,
      "formation:write",
      async (transaction) => {
        const existing = await transaction.businessIntentProposal.findFirst({
          where: {
            id,
            organizationId: principal.organizationId,
            workspaceId: principal.workspaceId,
          },
          select: { id: true, status: true, version: true, createdByUserId: true },
        });
        if (!existing) throw new Error("INTENT_PROPOSAL_NOT_FOUND");
        if (existing.status === "APPROVED" || existing.status === "REJECTED") {
          throw new Error("INTENT_PROPOSAL_FINAL");
        }
        if (existing.createdByUserId === principal.userId) {
          throw new Error("INTENT_PROPOSAL_SELF_REVIEW");
        }
        if (existing.version !== parsed.data.expectedVersion) {
          throw new Error("INTENT_PROPOSAL_VERSION_CONFLICT");
        }

        const reviewedAt = new Date();
        const updatedCount = await transaction.businessIntentProposal.updateMany({
          where: {
            id: existing.id,
            organizationId: principal.organizationId,
            workspaceId: principal.workspaceId,
            version: parsed.data.expectedVersion,
            status: { notIn: ["APPROVED", "REJECTED"] },
          },
          data: {
            status: parsed.data.decision,
            reviewedByUserId: principal.userId,
            reviewNote: parsed.data.note,
            reviewedAt,
            version: { increment: 1 },
          },
        });
        if (updatedCount.count !== 1) {
          throw new Error("INTENT_PROPOSAL_VERSION_CONFLICT");
        }
        const updated = await transaction.businessIntentProposal.findFirst({
          where: {
            id: existing.id,
            organizationId: principal.organizationId,
            workspaceId: principal.workspaceId,
            version: parsed.data.expectedVersion + 1,
          },
        });
        if (!updated) throw new Error("INTENT_PROPOSAL_VERSION_CONFLICT");
        await transaction.businessIntentProposalReview.create({
          data: {
            proposalId: existing.id,
            workspaceId: principal.workspaceId,
            reviewerUserId: principal.userId,
            decision: parsed.data.decision,
            note: parsed.data.note,
            occurredAt: reviewedAt,
          },
        });
        await transaction.activity.create({
          data: {
            workspaceId: principal.workspaceId,
            actorId: principal.userId,
            type: "REVIEWED",
            title: "Business intent proposal reviewed",
            summary: `Proposal decision recorded: ${parsed.data.decision}.`,
            metadata: {
              proposalId: existing.id,
              priorProposalVersion: existing.version,
              proposalVersion: updated.version,
              fromStatus: existing.status,
              toStatus: parsed.data.decision,
              reviewerUserId: principal.userId,
            },
          },
        });
        return updated;
      },
    );

    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and retry." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "INTENT_PROPOSAL_NOT_FOUND") {
      return NextResponse.json({ error: "Business-intent proposal not found in the active workspace." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "INTENT_PROPOSAL_FINAL") {
      return NextResponse.json({ error: "Approved or rejected proposals are immutable. Create a new proposal to reconsider the decision." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "INTENT_PROPOSAL_SELF_REVIEW") {
      return NextResponse.json({ error: "A different authorized reviewer must review this proposal." }, { status: 403 });
    }
    if (error instanceof Error && error.message === "INTENT_PROPOSAL_VERSION_CONFLICT") {
      return NextResponse.json({ error: "Proposal changed during review. Refresh it and submit the decision against the latest version." }, { status: 409 });
    }
    if (isSerializationConflict(error)) {
      return NextResponse.json({ error: "Proposal changed during review. Refresh and retry." }, { status: 409 });
    }
    console.error("Business-intent proposal review failed.", safeErrorCode(error));
    return NextResponse.json({ error: "Unable to record the proposal review." }, { status: 500 });
  }
}

function isSerializationConflict(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error &&
    (error as { code?: unknown }).code === "P2034";
}

function safeErrorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error &&
    typeof (error as { code?: unknown }).code === "string") {
    return (error as { code: string }).code;
  }
  return error instanceof Error ? error.name : "unknown";
}
