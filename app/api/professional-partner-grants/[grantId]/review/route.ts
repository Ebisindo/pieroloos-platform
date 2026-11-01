import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { reviewProfessionalPartnerGrantSchema } from "@/lib/validation/professional-partner";

type RouteContext = { params: Promise<{ grantId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("workspace:manage")) {
    return NextResponse.json({ error: "Workspace management permission required." }, { status: 403 });
  }

  const parsed = reviewProfessionalPartnerGrantSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid partner grant review decision.", issues: parsed.error.flatten() }, { status: 422 });
  const principal = context.principal;
  const { grantId } = await params;
  const expectedUpdatedAt = new Date(parsed.data.expectedUpdatedAt);
  const reviewedAt = new Date();

  try {
    const grant = await withAuthorizedWorkspaceTransaction(principal, "workspace:manage", async (tx) => {
      const current = await tx.professionalPartnerGrant.findFirst({
        where: { id: grantId, organizationId: principal.organizationId, workspaceId: principal.workspaceId },
        select: {
          id: true, clientId: true, partnerIdentityId: true, status: true, grantedByUserId: true,
          updatedAt: true, expiresAt: true, purpose: true, purposeDetails: true, capabilities: true,
          partnerIdentity: { select: { userId: true, status: true } },
        },
      });
      if (!current) throw new Error("PROFESSIONAL_PARTNER_GRANT_NOT_FOUND");
      if (current.status !== "PENDING_REVIEW" || current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
        throw new Error("PROFESSIONAL_PARTNER_GRANT_STATE_CONFLICT");
      }
      if (current.grantedByUserId === principal.userId || current.partnerIdentity.userId === principal.userId) {
        throw new Error("PROFESSIONAL_PARTNER_GRANT_SELF_REVIEW");
      }

      if (parsed.data.decision === "APPROVE") {
        if (current.partnerIdentity.status !== "VERIFIED") throw new Error("PROFESSIONAL_PARTNER_IDENTITY_NOT_VERIFIED");
        if (current.expiresAt && current.expiresAt <= reviewedAt) throw new Error("PROFESSIONAL_PARTNER_GRANT_EXPIRED");
        const member = await tx.membership.findUnique({
          where: { userId_organizationId: { userId: current.partnerIdentity.userId, organizationId: principal.organizationId } },
          select: { id: true },
        });
        if (member) throw new Error("PROFESSIONAL_PARTNER_USER_IS_STAFF");
      }

      const status = parsed.data.decision === "APPROVE" ? "ACTIVE" : "REJECTED";
      const update = await tx.professionalPartnerGrant.updateMany({
        where: {
          id: current.id,
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          status: "PENDING_REVIEW",
          updatedAt: expectedUpdatedAt,
        },
        data: {
          status,
          reviewedByUserId: principal.userId,
          reviewedAt,
          reviewNote: parsed.data.note,
        },
      });
      if (update.count !== 1) throw new Error("PROFESSIONAL_PARTNER_GRANT_STATE_CONFLICT");

      await tx.professionalPartnerGrantAuditEvent.create({
        data: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          clientId: current.clientId,
          grantId: current.id,
          partnerIdentityId: current.partnerIdentityId,
          actorUserId: principal.userId,
          action: status === "ACTIVE" ? "GRANT_APPROVED" : "GRANT_REJECTED",
          reason: parsed.data.note,
          metadata: {
            previousStatus: current.status,
            status,
            reviewedAt: reviewedAt.toISOString(),
            expectedUpdatedAt: expectedUpdatedAt.toISOString(),
            purpose: current.purpose,
            purposeDetails: current.purposeDetails,
            capabilities: current.capabilities,
            expiresAt: current.expiresAt?.toISOString() ?? null,
          },
        },
      });
      return tx.professionalPartnerGrant.findFirstOrThrow({
        where: { id: current.id, organizationId: principal.organizationId, workspaceId: principal.workspaceId },
      });
    });
    return NextResponse.json({ data: grant });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") return NextResponse.json({ error: "Workspace authorization changed. Refresh and retry." }, { status: 409 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_GRANT_NOT_FOUND") return NextResponse.json({ error: "Partner grant not found in the active workspace." }, { status: 404 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_GRANT_STATE_CONFLICT") return NextResponse.json({ error: "Grant changed or is no longer reviewable. Refresh and retry." }, { status: 409 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_GRANT_SELF_REVIEW") return NextResponse.json({ error: "Grant creator and partner subject cannot review this grant." }, { status: 403 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_IDENTITY_NOT_VERIFIED") return NextResponse.json({ error: "A verified, unsuspended partner identity is required before approval." }, { status: 409 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_GRANT_EXPIRED") return NextResponse.json({ error: "An expired grant cannot be activated. Create a new grant with a future expiry." }, { status: 409 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_USER_IS_STAFF") return NextResponse.json({ error: "A tenant staff member cannot be granted external partner access." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2004", "P2034"].includes(error.code)) return NextResponse.json({ error: "Grant review conflicted with concurrent or database integrity state. Refresh and retry." }, { status: 409 });
    console.error("Unable to review professional partner grant.");
    return NextResponse.json({ error: "Unable to review professional partner grant." }, { status: 500 });
  }
}
