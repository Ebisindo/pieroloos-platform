import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { createProfessionalPartnerGrantSchema } from "@/lib/validation/professional-partner";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_GRANT_DAYS = 90;
const MAX_GRANT_DAYS = 365;

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("workspace:manage")) {
    return NextResponse.json({ error: "Workspace management permission required." }, { status: 403 });
  }

  try {
    const grants = await withAuthorizedWorkspaceTransaction(context.principal, "workspace:manage", async (tx) =>
      tx.professionalPartnerGrant.findMany({
        where: {
          organizationId: context.principal!.organizationId,
          workspaceId: context.principal!.workspaceId,
        },
        select: {
          id: true, clientId: true, partnerIdentityId: true, purpose: true, purposeDetails: true,
          capabilities: true, status: true, grantedByUserId: true, reviewedByUserId: true,
          reviewedAt: true, reviewNote: true, changeRequestReason: true, expiresAt: true,
          revokedAt: true, revokedByUserId: true, revocationReason: true, createdAt: true, updatedAt: true,
          client: { select: { name: true, organizationName: true } },
          partnerIdentity: {
            select: {
              contactName: true, organizationName: true, professionalType: true, status: true, userId: true,
              user: { select: { name: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    );
    const now = new Date();
    return NextResponse.json({
      data: grants.map((grant) => ({
        ...grant,
        accessCurrentlyValid: grant.status === "ACTIVE" && grant.revokedAt === null &&
          (grant.expiresAt === null || grant.expiresAt > now) && grant.partnerIdentity.status === "VERIFIED",
      })),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") return NextResponse.json({ error: "Workspace authorization changed. Refresh and retry." }, { status: 409 });
    console.error("Unable to list professional partner grants.");
    return NextResponse.json({ error: "Unable to list professional partner grants." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("workspace:manage")) {
    return NextResponse.json({ error: "Workspace management permission required." }, { status: 403 });
  }

  const raw: unknown = await request.json().catch(() => null);
  const parsed = createProfessionalPartnerGrantSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Invalid professional partner grant.", issues: parsed.error.flatten() }, { status: 422 });
  const principal = context.principal;
  const input = parsed.data;
  const rawRecord = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const expiryWasSpecified = Object.prototype.hasOwnProperty.call(rawRecord, "expiresAt");
  const noExpiryRequested = expiryWasSpecified && rawRecord.expiresAt === null;
  if (noExpiryRequested && principal.role !== "owner") {
    return NextResponse.json({ error: "Only an organization owner may explicitly create a non-expiring professional partner grant." }, { status: 403 });
  }

  const now = new Date();
  const expiresAt = !expiryWasSpecified
    ? new Date(now.getTime() + DEFAULT_GRANT_DAYS * DAY_MS)
    : input.expiresAt ?? null;
  if (expiresAt && (expiresAt <= now || expiresAt.getTime() > now.getTime() + MAX_GRANT_DAYS * DAY_MS)) {
    return NextResponse.json({ error: "Grant expiry must be in the future and no more than 365 days away." }, { status: 422 });
  }

  const grantKey = createHash("sha256").update(input.idempotencyKey).digest("hex");
  const expiryMode = !expiryWasSpecified ? "DEFAULT_90_DAYS" : noExpiryRequested ? "NO_EXPIRY" : `FIXED:${expiresAt?.toISOString()}`;
  const requestDigest = createHash("sha256").update(JSON.stringify({
    organizationId: principal.organizationId,
    workspaceId: principal.workspaceId,
    clientId: input.clientId,
    partnerIdentityId: input.partnerIdentityId,
    purpose: input.purpose,
    purposeDetails: input.purposeDetails ?? null,
    capabilities: [...input.capabilities].sort(),
    expiryMode,
  })).digest("hex");

  try {
    const result = await withAuthorizedWorkspaceTransaction(principal, "workspace:manage", async (tx) => {
      const prior = await tx.professionalPartnerGrant.findFirst({
        where: { organizationId: principal.organizationId, workspaceId: principal.workspaceId, grantKey },
      });
      if (prior) {
        if (prior.requestDigest !== requestDigest) throw new Error("PROFESSIONAL_PARTNER_GRANT_IDEMPOTENCY_KEY_REUSED");
        return { grant: prior, alreadyExists: true };
      }

      const client = await tx.client.findFirst({
        where: {
          id: input.clientId,
          workspaceId: principal.workspaceId,
          OR: [{ organizationId: principal.organizationId }, { organizationId: null }],
        },
        select: { id: true },
      });
      if (!client) throw new Error("PROFESSIONAL_PARTNER_CLIENT_NOT_FOUND");

      const identity = await tx.professionalPartnerIdentity.findFirst({
        where: { id: input.partnerIdentityId, organizationId: principal.organizationId, workspaceId: principal.workspaceId },
        select: { id: true, userId: true, status: true },
      });
      if (!identity) throw new Error("PROFESSIONAL_PARTNER_IDENTITY_NOT_FOUND");
      if (identity.status !== "VERIFIED") throw new Error("PROFESSIONAL_PARTNER_IDENTITY_NOT_VERIFIED");
      if (identity.userId === principal.userId) throw new Error("PROFESSIONAL_PARTNER_SELF_GRANT");
      const member = await tx.membership.findUnique({
        where: { userId_organizationId: { userId: identity.userId, organizationId: principal.organizationId } },
        select: { id: true },
      });
      if (member) throw new Error("PROFESSIONAL_PARTNER_USER_IS_STAFF");

      const grant = await tx.professionalPartnerGrant.create({
        data: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          clientId: client.id,
          partnerIdentityId: identity.id,
          grantKey,
          requestDigest,
          purpose: input.purpose,
          purposeDetails: input.purposeDetails ?? null,
          capabilities: input.capabilities,
          status: "PENDING_REVIEW",
          grantedByUserId: principal.userId,
          expiresAt,
        },
      });
      await tx.professionalPartnerGrantAuditEvent.create({
        data: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          clientId: client.id,
          grantId: grant.id,
          partnerIdentityId: identity.id,
          actorUserId: principal.userId,
          action: "GRANT_CREATED",
          reason: input.purposeDetails ?? "Submitted for independent professional partner grant review.",
          metadata: {
            initialStatus: grant.status,
            purpose: grant.purpose,
            capabilities: grant.capabilities,
            expiresAt: grant.expiresAt?.toISOString() ?? null,
            expiryMode,
            requestDigest,
          },
        },
      });
      return { grant, alreadyExists: false };
    });

    return NextResponse.json({ data: result.grant, alreadyExists: result.alreadyExists }, { status: result.alreadyExists ? 200 : 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") return NextResponse.json({ error: "Workspace authorization changed. Refresh and retry." }, { status: 409 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_CLIENT_NOT_FOUND") return NextResponse.json({ error: "Client not found in the active workspace." }, { status: 404 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_IDENTITY_NOT_FOUND") return NextResponse.json({ error: "Partner identity not found in the active workspace." }, { status: 404 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_IDENTITY_NOT_VERIFIED") return NextResponse.json({ error: "Only independently verified partner identities may receive grants." }, { status: 409 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_SELF_GRANT") return NextResponse.json({ error: "Self-grant is not permitted." }, { status: 403 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_USER_IS_STAFF") return NextResponse.json({ error: "Organization members cannot also receive external professional partner grants in the same organization." }, { status: 409 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_GRANT_IDEMPOTENCY_KEY_REUSED") return NextResponse.json({ error: "This idempotency key was already used for different grant terms." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await prisma.professionalPartnerGrant.findFirst({
        where: { organizationId: principal.organizationId, workspaceId: principal.workspaceId, grantKey },
      });
      if (existing && existing.requestDigest === requestDigest) {
        return NextResponse.json({ data: existing, alreadyExists: true }, { status: 200 });
      }
      return NextResponse.json({ error: "A concurrent grant creation conflicted or reused the idempotency key." }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2004", "P2034"].includes(error.code)) return NextResponse.json({ error: "A concurrent grant state change or database integrity rule rejected the request." }, { status: 409 });
    console.error("Unable to create professional partner grant.");
    return NextResponse.json({ error: "Unable to create professional partner grant." }, { status: 500 });
  }
}
