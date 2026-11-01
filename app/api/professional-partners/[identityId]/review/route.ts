import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { reviewProfessionalPartnerIdentitySchema } from "@/lib/validation/professional-partner";

type RouteContext = { params: Promise<{ identityId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("workspace:manage")) {
    return NextResponse.json({ error: "Workspace management permission required." }, { status: 403 });
  }

  const parsed = reviewProfessionalPartnerIdentitySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid identity review decision.", issues: parsed.error.flatten() }, { status: 422 });
  const principal = context.principal;
  const { identityId } = await params;
  const input = parsed.data;
  const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
  const reviewedAt = new Date();

  try {
    const identity = await withAuthorizedWorkspaceTransaction(principal, "workspace:manage", async (tx) => {
      const current = await tx.professionalPartnerIdentity.findFirst({
        where: {
          id: identityId,
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
        },
        select: { id: true, userId: true, createdByUserId: true, status: true, updatedAt: true },
      });
      if (!current) throw new Error("PROFESSIONAL_PARTNER_IDENTITY_NOT_FOUND");
      if (current.status !== "PENDING_VERIFICATION") throw new Error("PROFESSIONAL_PARTNER_IDENTITY_STATE_CONFLICT");
      if (current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) throw new Error("PROFESSIONAL_PARTNER_IDENTITY_STATE_CONFLICT");
      if (current.userId === principal.userId || current.createdByUserId === principal.userId) {
        throw new Error("PROFESSIONAL_PARTNER_IDENTITY_SELF_REVIEW");
      }

      const result = await tx.professionalPartnerIdentity.updateMany({
        where: {
          id: current.id,
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          status: "PENDING_VERIFICATION",
          updatedAt: expectedUpdatedAt,
        },
        data: {
          status: input.decision === "VERIFY" ? "VERIFIED" : "REJECTED",
          reviewedByUserId: principal.userId,
          reviewedAt,
          reviewNote: input.note,
        },
      });
      if (result.count !== 1) throw new Error("PROFESSIONAL_PARTNER_IDENTITY_STATE_CONFLICT");

      await tx.professionalPartnerIdentityAuditEvent.create({
        data: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          identityId: current.id,
          actorUserId: principal.userId,
          action: input.decision === "VERIFY" ? "IDENTITY_VERIFIED" : "IDENTITY_REJECTED",
          note: input.note,
          metadata: {
            previousStatus: current.status,
            status: input.decision === "VERIFY" ? "VERIFIED" : "REJECTED",
            reviewedAt: reviewedAt.toISOString(),
            expectedUpdatedAt: expectedUpdatedAt.toISOString(),
          },
        },
      });
      return tx.professionalPartnerIdentity.findFirstOrThrow({
        where: { id: current.id, organizationId: principal.organizationId, workspaceId: principal.workspaceId },
      });
    });
    return NextResponse.json({ data: identity });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") return NextResponse.json({ error: "Workspace authorization changed. Refresh and retry." }, { status: 409 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_IDENTITY_NOT_FOUND") return NextResponse.json({ error: "Partner identity not found in the active workspace." }, { status: 404 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_IDENTITY_SELF_REVIEW") return NextResponse.json({ error: "Identity creator and partner subject cannot review this identity." }, { status: 403 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_IDENTITY_STATE_CONFLICT") return NextResponse.json({ error: "Identity state changed or is no longer reviewable. Refresh and retry." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) return NextResponse.json({ error: "A concurrent identity review conflicted. Refresh and retry." }, { status: 409 });
    console.error("Unable to review professional partner identity.");
    return NextResponse.json({ error: "Unable to review professional partner identity." }, { status: 500 });
  }
}
