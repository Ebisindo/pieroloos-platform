import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { prisma } from "@/lib/db/prisma";
import { reminderSchema } from "@/lib/validation/compliance";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, routeContext: RouteContext) {
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
  if (!context.principal.permissions.includes("compliance:write")) {
    return NextResponse.json({ error: "Compliance write permission required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = reminderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid reminder.", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const now = new Date();
  if (parsed.data.scheduledFor.getTime() < now.getTime()) {
    return NextResponse.json({ error: "Reminder time cannot be in the past." }, { status: 422 });
  }

  const principal = context.principal;
  const { id: obligationId } = await routeContext.params;
  let dedupeKey = "";
  try {
    const result = await withAuthorizedWorkspaceTransaction(
      principal,
      "compliance:write",
      async (transaction) => {
        const obligation = await transaction.complianceObligation.findFirst({
          where: {
            id: obligationId,
            organizationId: principal.organizationId,
            workspaceId: principal.workspaceId,
          },
          select: { id: true, title: true, status: true, ownerUserId: true },
        });
        if (!obligation) throw new Error("COMPLIANCE_OBLIGATION_NOT_FOUND");
        if (["COMPLETE", "COMPLETED", "COMPLIANT", "WAIVED", "NOT_APPLICABLE"].includes(obligation.status)) {
          throw new Error("COMPLIANCE_OBLIGATION_CLOSED");
        }

        const recipientUserId = obligation.ownerUserId ?? principal.userId;
        const recipientMembership = await transaction.membership.findUnique({
          where: {
            userId_organizationId: {
              userId: recipientUserId,
              organizationId: principal.organizationId,
            },
          },
          select: { userId: true },
        });
        if (!recipientMembership) throw new Error("REMINDER_RECIPIENT_NOT_IN_ORGANIZATION");

        const messageDigest = createHash("sha256").update(parsed.data.message).digest("hex").slice(0, 16);
        dedupeKey = [
          "compliance-reminder",
          obligation.id,
          recipientUserId,
          parsed.data.channel.toLowerCase(),
          parsed.data.scheduledFor.toISOString(),
          messageDigest,
        ].join(":");

        const existing = await transaction.complianceNotification.findUnique({
          where: {
            organizationId_workspaceId_dedupeKey: {
              organizationId: principal.organizationId,
              workspaceId: principal.workspaceId,
              dedupeKey,
            },
          },
        });
        if (existing) return { notification: existing, alreadyScheduled: true };

        const notification = await transaction.complianceNotification.create({
          data: {
            organizationId: principal.organizationId,
            workspaceId: principal.workspaceId,
            obligationId: obligation.id,
            recipientUserId,
            channel: parsed.data.channel,
            subject: `Compliance reminder: ${obligation.title}`,
            body: parsed.data.message,
            scheduledFor: parsed.data.scheduledFor,
            nextAttemptAt: parsed.data.scheduledFor,
            dedupeKey,
            templateKey: "legacy-notification",
            templateVersion: 1,
          },
        });
        await transaction.complianceReminder.create({
          data: {
            obligationId: obligation.id,
            scheduledFor: parsed.data.scheduledFor,
            channel: parsed.data.channel,
            message: parsed.data.message,
          },
        });
        await transaction.complianceActivity.create({
          data: {
            obligationId: obligation.id,
            action: "REMINDER_SCHEDULED",
            actorUserId: principal.userId,
            note: parsed.data.message,
            metadata: {
              notificationId: notification.id,
              recipientUserId,
              channel: parsed.data.channel,
              scheduledFor: parsed.data.scheduledFor.toISOString(),
              dedupeKey,
            },
          },
        });
        return { notification, alreadyScheduled: false };
      },
    );
    return NextResponse.json(
      { data: result.notification, alreadyScheduled: result.alreadyScheduled },
      { status: result.alreadyScheduled ? 200 : 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_OBLIGATION_NOT_FOUND") {
      return NextResponse.json({ error: "Compliance obligation not found in the active workspace." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_OBLIGATION_CLOSED") {
      return NextResponse.json({ error: "Reminders cannot be scheduled for a closed obligation." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "REMINDER_RECIPIENT_NOT_IN_ORGANIZATION") {
      return NextResponse.json({ error: "Reminder recipient is not a member of the active organization." }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && dedupeKey) {
      const existing = await prisma.complianceNotification.findFirst({
        where: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          dedupeKey,
        },
      });
      if (existing) return NextResponse.json({ data: existing, alreadyScheduled: true }, { status: 200 });
    }
    console.error("Compliance reminder scheduling failed.", error);
    return NextResponse.json({ error: "Unable to schedule compliance reminder." }, { status: 500 });
  }
}
