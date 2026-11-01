import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { revokeProfessionalPartnerGrantSchema } from "@/lib/validation/professional-partner";

type RouteContext = { params: Promise<{ grantId: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("workspace:manage")) {
    return NextResponse.json({ error: "Workspace management permission required." }, { status: 403 });
  }

  const parsed = revokeProfessionalPartnerGrantSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid grant revocation request.", issues: parsed.error.flatten() }, { status: 422 });
  const principal = context.principal;
  const { grantId } = await params;
  const expectedUpdatedAt = new Date(parsed.data.expectedUpdatedAt);
  const revokedAt = new Date();

  try {
    const grant = await withAuthorizedWorkspaceTransaction(principal, "workspace:manage", async (tx) => {
      const current = await tx.professionalPartnerGrant.findFirst({
        where: { id: grantId, organizationId: principal.organizationId, workspaceId: principal.workspaceId },
        select: {
          id: true, clientId: true, partnerIdentityId: true, status: true, updatedAt: true,
          partnerIdentity: { select: { userId: true } },
        },
      });
      if (!current) throw new Error("PROFESSIONAL_PARTNER_GRANT_NOT_FOUND");
      if (!["ACTIVE", "PENDING_REVIEW"].includes(current.status) ||
          current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
        throw new Error("PROFESSIONAL_PARTNER_GRANT_STATE_CONFLICT");
      }
      if (current.partnerIdentity.userId === principal.userId) throw new Error("PROFESSIONAL_PARTNER_GRANT_SELF_REVOCATION");

      const result = await tx.professionalPartnerGrant.updateMany({
        where: {
          id: current.id,
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          status: current.status,
          updatedAt: expectedUpdatedAt,
        },
        data: {
          status: "REVOKED",
          revokedAt,
          revokedByUserId: principal.userId,
          revocationReason: parsed.data.reason,
        },
      });
      if (result.count !== 1) throw new Error("PROFESSIONAL_PARTNER_GRANT_STATE_CONFLICT");

      await tx.professionalPartnerGrantAuditEvent.create({
        data: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          clientId: current.clientId,
          grantId: current.id,
          partnerIdentityId: current.partnerIdentityId,
          actorUserId: principal.userId,
          action: "GRANT_REVOKED",
          reason: parsed.data.reason,
          metadata: {
            previousStatus: current.status,
            status: "REVOKED",
            revokedAt: revokedAt.toISOString(),
            expectedUpdatedAt: expectedUpdatedAt.toISOString(),
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
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_GRANT_STATE_CONFLICT") return NextResponse.json({ error: "Grant changed or is already terminal. Refresh and retry." }, { status: 409 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_GRANT_SELF_REVOCATION") return NextResponse.json({ error: "A partner cannot revoke their own grant through the management endpoint." }, { status: 403 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2004", "P2034"].includes(error.code)) return NextResponse.json({ error: "Grant revocation conflicted with a concurrent change or database integrity rule." }, { status: 409 });
    console.error("Unable to revoke professional partner grant.");
    return NextResponse.json({ error: "Unable to revoke professional partner grant." }, { status: 500 });
  }
}
