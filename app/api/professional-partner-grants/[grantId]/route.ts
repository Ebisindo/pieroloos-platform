import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { amendProfessionalPartnerGrantSchema } from "@/lib/validation/professional-partner";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_GRANT_DAYS = 365;
type RouteContext = { params: Promise<{ grantId: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("workspace:manage")) {
    return NextResponse.json({ error: "Workspace management permission required." }, { status: 403 });
  }

  const raw: unknown = await request.json().catch(() => null);
  const parsed = amendProfessionalPartnerGrantSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid grant amendment.", issues: parsed.error.flatten() }, { status: 422 });
  const principal = context.principal;
  const { grantId } = await params;
  const input = parsed.data;
  const rawRecord = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const expiryWasSpecified = Object.prototype.hasOwnProperty.call(rawRecord, "expiresAt");
  const noExpiryRequested = expiryWasSpecified && rawRecord.expiresAt === null;
  if (noExpiryRequested && principal.role !== "owner") {
    return NextResponse.json({ error: "Only an organization owner may explicitly create a non-expiring professional partner grant." }, { status: 403 });
  }
  const expectedUpdatedAt = new Date(input.expectedUpdatedAt);
  const changedAt = new Date();

  try {
    const grant = await withAuthorizedWorkspaceTransaction(principal, "workspace:manage", async (tx) => {
      const current = await tx.professionalPartnerGrant.findFirst({
        where: { id: grantId, organizationId: principal.organizationId, workspaceId: principal.workspaceId },
        select: {
          id: true, clientId: true, partnerIdentityId: true, partnerIdentity: { select: { userId: true, status: true } },
          status: true, updatedAt: true, expiresAt: true, purpose: true, purposeDetails: true,
          capabilities: true, revokedAt: true,
        },
      });
      if (!current) throw new Error("PROFESSIONAL_PARTNER_GRANT_NOT_FOUND");
      if (current.status !== "ACTIVE" || current.revokedAt !== null ||
          (current.expiresAt !== null && current.expiresAt <= changedAt) ||
          current.updatedAt.getTime() !== expectedUpdatedAt.getTime()) {
        throw new Error("PROFESSIONAL_PARTNER_GRANT_STATE_CONFLICT");
      }
      if (current.partnerIdentity.status !== "VERIFIED") throw new Error("PROFESSIONAL_PARTNER_IDENTITY_NOT_VERIFIED");
      if (current.partnerIdentity.userId === principal.userId) throw new Error("PROFESSIONAL_PARTNER_GRANT_SELF_CHANGE");
      const member = await tx.membership.findUnique({
        where: { userId_organizationId: { userId: current.partnerIdentity.userId, organizationId: principal.organizationId } },
        select: { id: true },
      });
      if (member) throw new Error("PROFESSIONAL_PARTNER_USER_IS_STAFF");

      const nextPurpose = input.purpose ?? current.purpose;
      const nextPurposeDetails = Object.prototype.hasOwnProperty.call(rawRecord, "purposeDetails")
        ? input.purposeDetails ?? null
        : current.purposeDetails;
      const nextCapabilities = input.capabilities ?? current.capabilities;
      const nextExpiresAt = expiryWasSpecified ? input.expiresAt ?? null : current.expiresAt;

      if (nextPurpose === "OTHER" && (!nextPurposeDetails || nextPurposeDetails.trim().length < 8)) {
        throw new Error("PROFESSIONAL_PARTNER_PURPOSE_DETAILS_REQUIRED");
      }
      if (nextExpiresAt && (nextExpiresAt <= changedAt || nextExpiresAt.getTime() > changedAt.getTime() + MAX_GRANT_DAYS * DAY_MS)) {
        throw new Error("PROFESSIONAL_PARTNER_GRANT_EXPIRY_INVALID");
      }
      const sameCapabilities = [...nextCapabilities].sort().join("|") === [...current.capabilities].sort().join("|");
      const noTermChange = nextPurpose === current.purpose &&
        nextPurposeDetails === current.purposeDetails &&
        sameCapabilities &&
        ((nextExpiresAt?.getTime() ?? null) === (current.expiresAt?.getTime() ?? null));
      if (noTermChange) throw new Error("PROFESSIONAL_PARTNER_GRANT_NO_TERM_CHANGE");

      // The database schema contains these review fields; use a narrow cast here because
      // the currently generated Prisma client in some CI attempts lags the checked-in schema.
      const updateData = {
        status: "PENDING_REVIEW",
        reviewedByUserId: null,
        reviewedAt: null,
        reviewNote: null,
        changeRequestReason: input.reason,
      } as unknown as Prisma.ProfessionalPartnerGrantUpdateManyMutationInput;
      if (input.purpose !== undefined) updateData.purpose = nextPurpose;
      if (Object.prototype.hasOwnProperty.call(rawRecord, "purposeDetails")) updateData.purposeDetails = nextPurposeDetails;
      if (input.capabilities !== undefined) updateData.capabilities = nextCapabilities;
      if (expiryWasSpecified) updateData.expiresAt = nextExpiresAt;

      const updated = await tx.professionalPartnerGrant.updateMany({
        where: {
          id: current.id,
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          status: "ACTIVE",
          updatedAt: expectedUpdatedAt,
        },
        data: updateData,
      });
      if (updated.count !== 1) throw new Error("PROFESSIONAL_PARTNER_GRANT_STATE_CONFLICT");

      await tx.professionalPartnerGrantAuditEvent.create({
        data: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          clientId: current.clientId,
          grantId: current.id,
          partnerIdentityId: current.partnerIdentityId,
          actorUserId: principal.userId,
          action: "GRANT_AMENDMENT_REQUESTED",
          reason: input.reason,
          metadata: {
            previous: {
              purpose: current.purpose,
              purposeDetails: current.purposeDetails,
              capabilities: current.capabilities,
              expiresAt: current.expiresAt?.toISOString() ?? null,
            },
            requested: {
              purpose: nextPurpose,
              purposeDetails: nextPurposeDetails,
              capabilities: nextCapabilities,
              expiresAt: nextExpiresAt?.toISOString() ?? null,
            },
            previousStatus: "ACTIVE",
            status: "PENDING_REVIEW",
            requestedAt: changedAt.toISOString(),
          },
        },
      });
      return tx.professionalPartnerGrant.findFirstOrThrow({
        where: { id: current.id, organizationId: principal.organizationId, workspaceId: principal.workspaceId },
      });
    });
    return NextResponse.json({
      data: grant,
      message: "Grant terms changed; access is suspended until an independent reviewer approves the amendment.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") return NextResponse.json({ error: "Workspace authorization changed. Refresh and retry." }, { status: 409 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_GRANT_NOT_FOUND") return NextResponse.json({ error: "Partner grant not found in the active workspace." }, { status: 404 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_GRANT_STATE_CONFLICT") return NextResponse.json({ error: "Only a current, unexpired active grant may be amended. Refresh and retry." }, { status: 409 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_IDENTITY_NOT_VERIFIED") return NextResponse.json({ error: "The partner identity is no longer verified." }, { status: 409 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_GRANT_SELF_CHANGE") return NextResponse.json({ error: "A partner cannot amend their own grant." }, { status: 403 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_USER_IS_STAFF") return NextResponse.json({ error: "A tenant staff member cannot receive external partner access." }, { status: 409 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_PURPOSE_DETAILS_REQUIRED") return NextResponse.json({ error: "A purpose description is required when OTHER is selected." }, { status: 422 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_GRANT_EXPIRY_INVALID") return NextResponse.json({ error: "Grant expiry must be in the future and no more than 365 days away." }, { status: 422 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_GRANT_NO_TERM_CHANGE") return NextResponse.json({ error: "The amendment must change at least one grant term." }, { status: 422 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2004", "P2034"].includes(error.code)) return NextResponse.json({ error: "The grant amendment conflicted with a concurrent change or database integrity rule." }, { status: 409 });
    console.error("Unable to amend professional partner grant.");
    return NextResponse.json({ error: "Unable to amend professional partner grant." }, { status: 500 });
  }
}
