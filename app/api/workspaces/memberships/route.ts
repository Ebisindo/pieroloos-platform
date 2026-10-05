import { NextResponse } from "next/server";
import { z } from "zod";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { prisma } from "@/lib/db/prisma";

const updateMembershipSchema = z.object({
  membershipId: z.string().min(1),
  role: z.enum(["OWNER", "ADMIN", "ADVISOR", "MEMBER", "VIEWER"]),
}).strict();

const removeMembershipSchema = z.object({ membershipId: z.string().min(1) }).strict();

function requireOwner(context: Awaited<ReturnType<typeof getWorkspaceContext>>) {
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (context.principal.role !== "owner" || !context.principal.permissions.includes("workspace:manage")) {
    return NextResponse.json({ error: "Organization owner permission required." }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const context = await getWorkspaceContext();
  const denied = requireOwner(context);
  if (denied) return denied;
  const principal = context.principal!;

  const memberships = await prisma.membership.findMany({
    where: { organizationId: principal.organizationId },
    select: {
      id: true,
      role: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true } },
    },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json({ data: memberships });
}

export async function PATCH(request: Request) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const context = await getWorkspaceContext();
  const denied = requireOwner(context);
  if (denied) return denied;
  const principal = context.principal!;
  const parsed = updateMembershipSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid membership role update.", issues: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const result = await withAuthorizedWorkspaceTransaction(principal, "workspace:manage", async (tx) => {
      if (principal.role !== "owner") throw new Error("OWNER_REQUIRED");
      const membership = await tx.membership.findFirst({
        where: { id: parsed.data.membershipId, organizationId: principal.organizationId },
        select: { id: true, userId: true, role: true },
      });
      if (!membership) throw new Error("MEMBERSHIP_NOT_FOUND");

      if (membership.role === "OWNER" && parsed.data.role !== "OWNER") {
        const ownerCount = await tx.membership.count({
          where: { organizationId: principal.organizationId, role: "OWNER" },
        });
        if (ownerCount <= 1) throw new Error("LAST_OWNER");
      }

      const updated = await tx.membership.updateMany({
        where: { id: membership.id, organizationId: principal.organizationId, role: membership.role },
        data: { role: parsed.data.role },
      });
      if (updated.count !== 1) throw new Error("MEMBERSHIP_CHANGED_CONCURRENTLY");

      await tx.activity.create({
        data: {
          workspaceId: principal.workspaceId,
          actorId: principal.userId,
          type: "UPDATED",
          title: "Organization membership role changed",
          summary: "An organization membership role was changed by an owner.",
          metadata: {
            membershipId: membership.id,
            subjectUserId: membership.userId,
            fromRole: membership.role,
            toRole: parsed.data.role,
          },
        },
      });
      return tx.membership.findFirst({
        where: { id: membership.id, organizationId: principal.organizationId },
        select: { id: true, role: true, user: { select: { id: true, email: true, name: true } } },
      });
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof Error && error.message === "MEMBERSHIP_NOT_FOUND") {
      return NextResponse.json({ error: "Membership not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "LAST_OWNER") {
      return NextResponse.json({ error: "An organization must retain at least one owner." }, { status: 409 });
    }
    if (error instanceof Error && ["OWNER_REQUIRED", "WORKSPACE_AUTHORIZATION_STALE"].includes(error.message)) {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "MEMBERSHIP_CHANGED_CONCURRENTLY") {
      return NextResponse.json({ error: "Membership changed concurrently. Refresh and try again." }, { status: 409 });
    }
    console.error("Unable to update organization membership role.", error);
    return NextResponse.json({ error: "Unable to update organization membership role." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const context = await getWorkspaceContext();
  const denied = requireOwner(context);
  if (denied) return denied;
  const principal = context.principal!;
  const parsed = removeMembershipSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid membership removal.", issues: parsed.error.flatten() }, { status: 422 });
  }

  try {
    await withAuthorizedWorkspaceTransaction(principal, "workspace:manage", async (tx) => {
      if (principal.role !== "owner") throw new Error("OWNER_REQUIRED");
      const membership = await tx.membership.findFirst({
        where: { id: parsed.data.membershipId, organizationId: principal.organizationId },
        select: { id: true, userId: true, role: true },
      });
      if (!membership) throw new Error("MEMBERSHIP_NOT_FOUND");

      if (membership.role === "OWNER") {
        const ownerCount = await tx.membership.count({
          where: { organizationId: principal.organizationId, role: "OWNER" },
        });
        if (ownerCount <= 1) throw new Error("LAST_OWNER");
      }

      const removed = await tx.membership.deleteMany({
        where: { id: membership.id, organizationId: principal.organizationId },
      });
      if (removed.count !== 1) throw new Error("MEMBERSHIP_CHANGED_CONCURRENTLY");

      await tx.activity.create({
        data: {
          workspaceId: principal.workspaceId,
          actorId: principal.userId,
          type: "UPDATED",
          title: "Organization membership removed",
          summary: "An organization membership was removed by an owner.",
          metadata: { membershipId: membership.id, subjectUserId: membership.userId, previousRole: membership.role },
        },
      });
    });
    return NextResponse.json({ data: { removed: true } });
  } catch (error) {
    if (error instanceof Error && error.message === "MEMBERSHIP_NOT_FOUND") {
      return NextResponse.json({ error: "Membership not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "LAST_OWNER") {
      return NextResponse.json({ error: "An organization must retain at least one owner." }, { status: 409 });
    }
    if (error instanceof Error && ["OWNER_REQUIRED", "WORKSPACE_AUTHORIZATION_STALE"].includes(error.message)) {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "MEMBERSHIP_CHANGED_CONCURRENTLY") {
      return NextResponse.json({ error: "Membership changed concurrently. Refresh and try again." }, { status: 409 });
    }
    console.error("Unable to remove organization membership.", error);
    return NextResponse.json({ error: "Unable to remove organization membership." }, { status: 500 });
  }
}
