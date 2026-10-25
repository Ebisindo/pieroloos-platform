import { NextResponse } from "next/server";
import { ContinuityCaseStatus, SuccessorStatus } from "@prisma/client";
import { hasValidWorkerSecret } from "@/lib/auth/worker-secret";
import { prisma } from "@/lib/db/prisma";
import { shouldWarn, hasReachedTrigger } from "@/lib/domain/successor-continuity";
import { sendNotificationEmail } from "@/lib/services/notification-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!process.env.OPERATIONAL_WORKER_SECRET) {
    return NextResponse.json({ error: "Operational worker is not configured." }, { status: 503 });
  }
  if (!hasValidWorkerSecret(request, "OPERATIONAL_WORKER_SECRET")) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const now = new Date();
  const candidates = await prisma.successor.findMany({
    where: { status: { in: [SuccessorStatus.PENDING, SuccessorStatus.ACCEPTED] } },
    orderBy: { lastOwnerActivityAt: "asc" },
    take: 250,
    select: {
      id: true, ownerId: true, successorName: true, successorEmail: true,
      autoActivateAfterDays: true, lastOwnerActivityAt: true, warningSentAt: true,
      owner: { select: { email: true, name: true } },
    },
  });
  const summary = { examined: candidates.length, warningsSent: 0, reviewCasesOpened: 0, skipped: 0, failures: 0 };

  for (const successor of candidates) {
    try {
      if (shouldWarn(now, successor.lastOwnerActivityAt, successor.autoActivateAfterDays) && !successor.warningSentAt) {
        const warningAt = now;
        const createCase = await prisma.$transaction(async (tx) => {
          const claim = await tx.successor.updateMany({
            where: { id: successor.id, warningSentAt: null, lastOwnerActivityAt: successor.lastOwnerActivityAt, status: { in: [SuccessorStatus.PENDING, SuccessorStatus.ACCEPTED] } },
            data: { warningSentAt: warningAt },
          });
          if (!claim.count) return false;
          await tx.businessContinuityCase.create({
            data: { successorId: successor.id, status: ContinuityCaseStatus.WARNING_SENT, inactivityStartedAt: successor.lastOwnerActivityAt, warningSentAt: warningAt },
          });
          await tx.platformAuditEvent.create({
            data: {
              actorRole: "SYSTEM_WORKER", action: "handover_warning_sent", subjectType: "SUCCESSOR",
              subjectId: successor.id, outcome: "SUCCESS",
              details: { inactivityDays: successor.autoActivateAfterDays, ownerId: successor.ownerId },
            },
          });
          return true;
        }, { isolationLevel: "Serializable" });
        if (createCase) {
          await sendNotificationEmail({
            id: `successor-warning-${successor.id}-${warningAt.toISOString().slice(0, 10)}`,
            templateKey: "legacy-notification", templateVersion: 1,
            subject: "PieroloOS continuity warning — confirm owner activity",
            body: `A successor continuity review has started because your owner activity has not been updated. Your configured inactivity trigger is ${successor.autoActivateAfterDays} days. This does not establish incapacity and will not transfer ownership automatically. Sign in to PieroloOS and use “I’m Alive” to reset the timer or review the protocol.`,
            recipientEmail: successor.owner.email,
          });
          summary.warningsSent += 1;
        } else summary.skipped += 1;
        continue;
      }

      if (hasReachedTrigger(now, successor.lastOwnerActivityAt, successor.autoActivateAfterDays)) {
        const openCase = await prisma.businessContinuityCase.findFirst({
          where: { successorId: successor.id, status: ContinuityCaseStatus.WARNING_SENT },
          select: { id: true, warningSentAt: true },
        });
        if (openCase && openCase.warningSentAt && now.getTime() >= openCase.warningSentAt.getTime() + 7 * 86400000) {
          const updated = await prisma.$transaction(async (tx) => {
            const caseChanged = await tx.businessContinuityCase.updateMany({
              where: { id: openCase.id, status: ContinuityCaseStatus.WARNING_SENT },
              data: { status: ContinuityCaseStatus.REVIEW_REQUIRED, reviewRequiredAt: now },
            });
            if (!caseChanged.count) return false;
            await tx.platformAuditEvent.create({
              data: {
                actorRole: "SYSTEM_WORKER", action: "handover_review_required", subjectType: "SUCCESSOR",
                subjectId: successor.id, outcome: "SUCCESS",
                details: { caseId: openCase.id, ownerId: successor.ownerId, automaticPrivilegeGrant: false },
              },
            });
            return true;
          }, { isolationLevel: "Serializable" });
          if (updated) summary.reviewCasesOpened += 1;
        }
      }
    } catch {
      // SMTP or a database race must not turn into automatic privilege escalation.
      summary.failures += 1;
    }
  }

  return NextResponse.json({ data: summary });
}
