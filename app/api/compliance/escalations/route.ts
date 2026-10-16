import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { prisma } from "@/lib/db/prisma";
import { escalateComplianceObligationSchema } from "@/lib/validation/compliance";

const MAX_ESCALATION_LEVEL = 5;
const CLOSED_OBLIGATION_STATUSES = new Set(["COMPLETE", "COMPLETED", "COMPLIANT", "WAIVED", "NOT_APPLICABLE"]);

function requestTarget(templateParams: unknown): string | null {
  if (!templateParams || typeof templateParams !== "object" || Array.isArray(templateParams)) return null;
  const target = (templateParams as Record<string, unknown>).requestTargetUserId;
  return typeof target === "string" ? target : null;
}

function requestedLevel(templateParams: unknown): number {
  if (!templateParams || typeof templateParams !== "object" || Array.isArray(templateParams)) return 0;
  const level = (templateParams as Record<string, unknown>).escalationLevel;
  return typeof level === "number" ? level : 0;
}

export async function POST(request: Request) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
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
  const parsed = escalateComplianceObligationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid compliance escalation request.", issues: parsed.error.flatten() }, { status: 422 });
  }

  const principal = context.principal;
  const input = parsed.data;
  const requestedTargetUserId = input.targetUserId ?? null;
  const idempotencyDigest = createHash("sha256").update(input.idempotencyKey).digest("hex").slice(0, 32);
  const dedupeKey = `compliance-escalation:${input.obligationId}:${idempotencyDigest}`;
  const reasonDigest = createHash("sha256").update(input.reason).digest("hex");

  try {
    const result = await withAuthorizedWorkspaceTransaction(principal, "compliance:write", async (transaction) => {
      const obligation = await transaction.complianceObligation.findFirst({
        where: {
          id: input.obligationId,
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
        },
        select: {
          id: true,
          title: true,
          status: true,
          ownerUserId: true,
          escalationLevel: true,
        },
      });
      if (!obligation) throw new Error("COMPLIANCE_OBLIGATION_NOT_FOUND");

      const existing = await transaction.complianceNotification.findUnique({
        where: {
          organizationId_workspaceId_dedupeKey: {
            organizationId: principal.organizationId,
            workspaceId: principal.workspaceId,
            dedupeKey,
          },
        },
      });
      if (existing) {
        const params = existing.templateParams && typeof existing.templateParams === "object" && !Array.isArray(existing.templateParams)
          ? existing.templateParams as Record<string, unknown>
          : {};
        if (existing.body !== input.reason ||
            params.reasonDigest !== reasonDigest ||
            requestTarget(existing.templateParams) !== requestedTargetUserId) {
          throw new Error("ESCALATION_IDEMPOTENCY_KEY_REUSED");
        }
        return { notification: existing, alreadyEscalated: true, escalationLevel: requestedLevel(existing.templateParams) };
      }

      if (CLOSED_OBLIGATION_STATUSES.has(obligation.status)) throw new Error("COMPLIANCE_OBLIGATION_CLOSED");
      if (obligation.escalationLevel >= MAX_ESCALATION_LEVEL) throw new Error("COMPLIANCE_ESCALATION_LIMIT");

      const targetUserId = requestedTargetUserId ?? obligation.ownerUserId ?? principal.userId;
      const targetMembership = await transaction.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: targetUserId,
            organizationId: principal.organizationId,
          },
        },
        select: { userId: true },
      });
      if (!targetMembership) throw new Error("ESCALATION_TARGET_NOT_MEMBER");

      const nextLevel = obligation.escalationLevel + 1;
      const changed = await transaction.complianceObligation.updateMany({
        where: {
          id: obligation.id,
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          status: obligation.status,
          escalationLevel: obligation.escalationLevel,
        },
        data: { escalationLevel: nextLevel },
      });
      if (changed.count !== 1) throw new Error("COMPLIANCE_ESCALATION_CONFLICT");

      const now = new Date();
      const notification = await transaction.complianceNotification.create({
        data: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          obligationId: obligation.id,
          recipientUserId: targetUserId,
          channel: "IN_APP",
          subject: `Compliance escalation level ${nextLevel}: ${obligation.title}`,
          body: input.reason,
          scheduledFor: now,
          nextAttemptAt: now,
          dedupeKey,
          templateKey: "compliance-escalation",
          templateVersion: 1,
          templateParams: {
            obligationId: obligation.id,
            title: obligation.title,
            escalationLevel: nextLevel,
            previousEscalationLevel: obligation.escalationLevel,
            requestedTargetUserId,
            targetUserId,
            reasonDigest,
            source: "WORKSPACE_COMPLIANCE_OPERATOR",
          },
        },
      });

      await transaction.complianceActivity.create({
        data: {
          obligationId: obligation.id,
          action: "OBLIGATION_ESCALATED",
          actorUserId: principal.userId,
          note: input.reason,
          metadata: {
            previousEscalationLevel: obligation.escalationLevel,
            escalationLevel: nextLevel,
            targetUserId,
            notificationId: notification.id,
            idempotencyDigest,
          },
        },
      });
      return { notification, alreadyEscalated: false, escalationLevel: nextLevel };
    });

    return NextResponse.json({ data: result.notification, alreadyEscalated: result.alreadyEscalated, escalationLevel: result.escalationLevel }, {
      status: result.alreadyEscalated ? 200 : 201,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_OBLIGATION_NOT_FOUND") {
      return NextResponse.json({ error: "Compliance obligation not found in the active workspace." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_OBLIGATION_CLOSED") {
      return NextResponse.json({ error: "Closed obligations cannot be escalated." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_ESCALATION_LIMIT") {
      return NextResponse.json({ error: "The maximum escalation level has been reached; a controlled administrative review is required." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "ESCALATION_TARGET_NOT_MEMBER") {
      return NextResponse.json({ error: "Escalation recipient must be a member of the active organization." }, { status: 422 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_ESCALATION_CONFLICT") {
      return NextResponse.json({ error: "Escalation state changed concurrently. Refresh and retry with a new idempotency key." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "ESCALATION_IDEMPOTENCY_KEY_REUSED") {
      return NextResponse.json({ error: "This idempotency key was already used with different escalation details." }, { status: 409 });
    }
    if (typeof error === "object" && error !== null && "code" in error && ["P2002", "P2034"].includes(String((error as { code?: unknown }).code))) {
      const existing = await prisma.complianceNotification.findFirst({
        where: {
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
          dedupeKey,
          obligationId: input.obligationId,
        },
      });
      if (existing && existing.body === input.reason) {
        return NextResponse.json({
          data: existing,
          alreadyEscalated: true,
          escalationLevel: requestedLevel(existing.templateParams),
        }, { status: 200 });
      }
      return NextResponse.json({ error: "A concurrent escalation conflicted. Refresh and retry." }, { status: 409 });
    }
    console.error("Compliance escalation failed.");
    return NextResponse.json({ error: "Unable to escalate the compliance obligation." }, { status: 500 });
  }
}
