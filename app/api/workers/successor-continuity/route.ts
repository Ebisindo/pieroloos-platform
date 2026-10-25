import { NextResponse } from "next/server";
import { ContinuityCaseStatus, SuccessorStatus } from "@prisma/client";
import { hasValidWorkerSecret } from "@/lib/auth/worker-secret";
import { prisma } from "@/lib/db/prisma";
import { shouldWarn, hasReachedTrigger } from "@/lib/domain/successor-continuity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!process.env.OPERATIONAL_WORKER_SECRET) return NextResponse.json({ error: "Operational worker is not configured." }, { status: 503 });
  if (!hasValidWorkerSecret(request, "OPERATIONAL_WORKER_SECRET")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const now = new Date();
  const candidates = await prisma.successor.findMany({
    where: { status: { in: [SuccessorStatus.PENDING, SuccessorStatus.ACCEPTED] } },
    orderBy: { lastOwnerActivityAt: "asc" }, take: 250,
    select: {
      id: true, ownerId: true, autoActivateAfterDays: true, lastOwnerActivityAt: true, warningSentAt: true,
      owner: { select: { email: true } },
      continuityCases: { where: { status: { in: [ContinuityCaseStatus.WARNING_SENT, ContinuityCaseStatus.REVIEW_REQUIRED] } }, select: { id: true, status: true, warningSentAt: true }, take: 1, orderBy: { createdAt: "desc" } },
    },
  });
  const summary = { examined: candidates.length, warningsQueued: 0, reviewCasesOpened: 0, skipped: 0, failures: 0 };

  for (const successor of candidates) {
    try {
      const currentCase = successor.continuityCases[0];
      if (shouldWarn(now, successor.lastOwnerActivityAt, successor.autoActivateAfterDays) && !successor.warningSentAt && !currentCase) {
        const claimed = await prisma.$transaction(async (tx) => {
          const membership = await tx.membership.findFirst({
            where: { userId: successor.ownerId }, orderBy: { createdAt: "asc" },
            select: { organizationId: true, organization: { select: { workspaces: { orderBy: { createdAt: "asc" }, take: 1, select: { id: true } } } } },
          });
          const workspace = membership?.organization.workspaces[0];
          if (!membership || !workspace) throw new Error("OWNER_WORKSPACE_UNAVAILABLE");
          const changed = await tx.successor.updateMany({
            where: { id: successor.id, warningSentAt: null, lastOwnerActivityAt: successor.lastOwnerActivityAt, status: { in: [SuccessorStatus.PENDING, SuccessorStatus.ACCEPTED] } },
            data: { warningSentAt: now },
          });
          if (!changed.count) return false;
          const newCase = await tx.businessContinuityCase.create({
            data: { successorId: successor.id, status: ContinuityCaseStatus.WARNING_SENT, inactivityStartedAt: successor.lastOwnerActivityAt, warningSentAt: now },
          });
          await tx.platformAuditEvent.create({
            data: { actorRole: "SYSTEM_WORKER", action: "handover_warning_sent", subjectType: "SUCCESSOR", subjectId: successor.id, outcome: "SUCCESS", details: { inactivityDays: successor.autoActivateAfterDays, ownerId: successor.ownerId, caseId: newCase.id, notificationQueued: true } },
          });
          // Only store the email in a private delivery marker; never include a bearer
          // token in worker logs or API output. Notification body is stripped pre-send.
          await tx.complianceNotification.create({
            data: {
              organizationId: membership.organizationId, workspaceId: workspace.id, channel: "EMAIL",
              subject: "PieroloOS continuity warning — confirm owner activity",
              body: `A successor continuity review has started because owner activity has not been updated. The configured inactivity trigger is ${successor.autoActivateAfterDays} days. This does not establish incapacity and will not transfer ownership automatically. Sign in to PieroloOS and use “I’m Alive” to reset the timer.\nInvitation recipient: ${successor.owner.email}`,
              recipientUserId: null, scheduledFor: now, dedupeKey: `continuity-warning-${newCase.id}`,
              templateKey: "legacy-notification", templateVersion: 1,
            },
          });
          return true;
        }, { isolationLevel: "Serializable" });
        if (claimed) summary.warningsQueued += 1; else summary.skipped += 1;
        continue;
      }

      if (hasReachedTrigger(now, successor.lastOwnerActivityAt, successor.autoActivateAfterDays) &&
        currentCase?.status === ContinuityCaseStatus.WARNING_SENT && currentCase.warningSentAt &&
        now.getTime() >= currentCase.warningSentAt.getTime() + 7 * 86400000) {
        const updated = await prisma.$transaction(async (tx) => {
          const changed = await tx.businessContinuityCase.updateMany({
            where: { id: currentCase.id, status: ContinuityCaseStatus.WARNING_SENT },
            data: { status: ContinuityCaseStatus.REVIEW_REQUIRED, reviewRequiredAt: now },
          });
          if (!changed.count) return false;
          await tx.platformAuditEvent.create({
            data: { actorRole: "SYSTEM_WORKER", action: "handover_review_required", subjectType: "SUCCESSOR", subjectId: successor.id, outcome: "SUCCESS", details: { caseId: currentCase.id, ownerId: successor.ownerId, automaticPrivilegeGrant: false } },
          });
          return true;
        }, { isolationLevel: "Serializable" });
        if (updated) summary.reviewCasesOpened += 1;
      }
    } catch {
      summary.failures += 1;
    }
  }
  return NextResponse.json({ data: summary });
}
