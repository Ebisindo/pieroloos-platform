import { NextResponse } from "next/server";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { prisma } from "@/lib/db/prisma";
import { createProfessionalPartnerIdentitySchema } from "@/lib/validation/professional-partner";
import { Prisma } from "@prisma/client";

export async function GET() {
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("workspace:manage")) {
    return NextResponse.json({ error: "Workspace management permission required." }, { status: 403 });
  }

  try {
    const identities = await withAuthorizedWorkspaceTransaction(context.principal, "workspace:manage", async (tx) =>
      tx.professionalPartnerIdentity.findMany({
        where: {
          organizationId: context.principal!.organizationId,
          workspaceId: context.principal!.workspaceId,
        },
        select: {
          id: true, userId: true, contactName: true, organizationName: true,
          professionalType: true, professionalRegistrationRef: true, status: true,
          createdByUserId: true, reviewedByUserId: true, reviewedAt: true, reviewNote: true,
          suspendedAt: true, suspensionReason: true, createdAt: true, updatedAt: true,
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
    );
    return NextResponse.json({ data: identities });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    console.error("Unable to list professional partner identities.");
    return NextResponse.json({ error: "Unable to list professional partner identities." }, { status: 500 });
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

  const parsed = createProfessionalPartnerIdentitySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid professional partner identity.", issues: parsed.error.flatten() }, { status: 422 });
  const principal = context.principal;
  const input = parsed.data;
  if (input.userId === principal.userId) {
    return NextResponse.json({ error: "Self-registration is not permitted. A separate external user must be registered by authorized staff." }, { status: 403 });
  }

  try {
    const identity = await withAuthorizedWorkspaceTransaction(principal, "workspace:manage", async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: { id: input.userId },
        select: { id: true },
      });
      if (!targetUser) throw new Error("PROFESSIONAL_PARTNER_USER_NOT_FOUND");

      const membership = await tx.membership.findUnique({
        where: { userId_organizationId: { userId: input.userId, organizationId: principal.organizationId } },
        select: { id: true },
      });
      if (membership) throw new Error("PROFESSIONAL_PARTNER_USER_IS_STAFF");

      const existing = await tx.professionalPartnerIdentity.findUnique({
        where: {
          organizationId_workspaceId_userId: {
            organizationId: principal.organizationId,
            workspaceId: principal.workspaceId,
            userId: input.userId,
          },
        },
        select: { id: true },
      });
      if (existing) throw new Error("PROFESSIONAL_PARTNER_IDENTITY_EXISTS");

      const created = await tx.professionalPartnerIdentity.create({
        data: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          userId: input.userId,
          contactName: input.contactName,
          organizationName: input.organizationName,
          professionalType: input.professionalType,
          professionalRegistrationRef: input.professionalRegistrationRef ?? null,
          status: "PENDING_VERIFICATION",
          createdByUserId: principal.userId,
        },
      });
      await tx.professionalPartnerIdentityAuditEvent.create({
        data: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          identityId: created.id,
          actorUserId: principal.userId,
          action: "IDENTITY_CREATED",
          note: "Partner identity entered for independent verification.",
          metadata: {
            subjectUserId: input.userId,
            professionalType: input.professionalType,
            registrationReferenceProvided: Boolean(input.professionalRegistrationRef),
            initialStatus: created.status,
          },
        },
      });
      return created;
    });

    return NextResponse.json({ data: identity }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_USER_NOT_FOUND") {
      return NextResponse.json({ error: "Partner user account was not found. Provision and verify the account first." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_USER_IS_STAFF") {
      return NextResponse.json({ error: "An organization staff member cannot be registered as an external professional partner in the same organization." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_IDENTITY_EXISTS") {
      return NextResponse.json({ error: "A partner identity already exists for this user in the active workspace." }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "A partner identity already exists for this user in the active workspace." }, { status: 409 });
    }
    console.error("Unable to create professional partner identity.");
    return NextResponse.json({ error: "Unable to create professional partner identity." }, { status: 500 });
  }
}
