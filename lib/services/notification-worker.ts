import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db/prisma";
import { sendNotificationEmail } from "@/lib/services/notification-email";

const MAX_BATCH_SIZE = 100;
const LEASE_MILLISECONDS = 5 * 60 * 1000;
const BASE_RETRY_MILLISECONDS = 30 * 1000;
const MAX_RETRY_MILLISECONDS = 6 * 60 * 60 * 1000;

type ClaimedNotification = {
  id: string;
  organizationId: string;
  workspaceId: string;
  recipientUserId: string | null;
  channel: "IN_APP" | "EMAIL";
  subject: string;
  body: string;
  templateKey: string;
  templateVersion: number;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  lockedBy: string | null;
};

function quietHoursEnd(
  now: Date,
  start: string | null,
  end: string | null,
  timezone: string,
) {
  if (!start || !end) return null;
  const toMinute = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };
  const startMinute = toMinute(start);
  const endMinute = toMinute(end);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const isQuiet = (date: Date) => {
    const parts = formatter.formatToParts(date);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);
    const current = hour * 60 + minute;
    return startMinute < endMinute
      ? current >= startMinute && current < endMinute
      : current >= startMinute || current < endMinute;
  };

  if (!isQuiet(now)) return null;
  for (let minute = 1; minute <= 26 * 60; minute += 1) {
    const candidate = new Date(now.getTime() + minute * 60 * 1000);
    if (!isQuiet(candidate)) return candidate;
  }
  throw new Error("Unable to find the end of configured notification quiet hours.");
}

function isPermanentFailure(error: unknown) {
  if (!(error instanceof Error)) return false;
  if (
    error.message.startsWith("Missing required SMTP setting:") ||
    [
      "NOTIFICATION_TEMPLATE_UNAVAILABLE",
      "INVALID_SMTP_PORT",
      "INVALID_SMTP_MESSAGE_ID_DOMAIN",
      "INVALID_SMTP_SECURE_SETTING",
      "SMTP_USERNAME_AND_PASSWORD_MUST_BE_PAIRED",
    ].includes(error.message)
  ) {
    return true;
  }
  const responseCode = "responseCode" in error ? error.responseCode : undefined;
  return typeof responseCode === "number" && responseCode >= 500;
}

function failureCode(error: unknown) {
  const code = error instanceof Error && "code" in error ? error.code : undefined;
  return typeof code === "string" && /^[A-Z0-9_-]{1,32}$/i.test(code)
    ? code.toUpperCase()
    : error instanceof Error && /^[A-Z0-9_-]{1,32}$/.test(error.message)
      ? error.message
      : "DELIVERY_FAILED";
}

function retryAt(now: Date, attemptCount: number) {
  const delay = Math.min(
    BASE_RETRY_MILLISECONDS * 2 ** Math.max(0, attemptCount - 1),
    MAX_RETRY_MILLISECONDS,
  );
  return new Date(now.getTime() + delay);
}

async function claimDueNotifications(now: Date, workerId: string, limit: number) {
  return prisma.$transaction(async (transaction) => {
    const staleLease = new Date(now.getTime() - LEASE_MILLISECONDS);
    const candidates = await transaction.complianceNotification.findMany({
      where: {
        OR: [
          { status: { in: ["QUEUED", "FAILED"] }, scheduledFor: { lte: now }, nextAttemptAt: { lte: now } },
          { status: "PROCESSING", lockedAt: { lte: staleLease } },
        ],
      },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
      take: limit,
    });

    const claimed: ClaimedNotification[] = [];
    for (const candidate of candidates) {
      const expiredLease = candidate.status === "PROCESSING";
      if (expiredLease && candidate.attemptCount > 0) {
        await transaction.notificationDeliveryAttempt.updateMany({
          where: {
            notificationId: candidate.id,
            attemptNumber: candidate.attemptCount,
            status: "ATTEMPTING",
          },
          data: {
            status: "RETRYABLE_FAILURE",
            completedAt: now,
            failureCode: "WORKER_LEASE_EXPIRED",
            failureMessage: "Worker lease expired before the delivery result was recorded.",
          },
        });
      }
      const exhaustedLease = expiredLease && candidate.attemptCount >= candidate.maxAttempts;
      const result = await transaction.complianceNotification.updateMany({
        where: {
          id: candidate.id,
          OR: [
            { status: { in: ["QUEUED", "FAILED"] }, scheduledFor: { lte: now }, nextAttemptAt: { lte: now } },
            { status: "PROCESSING", lockedAt: { lte: staleLease } },
          ],
        },
        data: exhaustedLease
          ? {
            status: "DEAD_LETTER",
            deadLetteredAt: now,
            failedAt: now,
            failureReason: "Worker lease expired after the maximum delivery attempts.",
            lockedAt: null,
            lockedBy: null,
          }
          : { status: "PROCESSING", lockedAt: now, lockedBy: workerId },
      });
      if (result.count !== 1 || exhaustedLease) continue;

      claimed.push({
        ...candidate,
        lockedBy: workerId,
      });
    }
    return claimed;
  });
}

async function loadRecipientContext(notification: ClaimedNotification) {
  if (!notification.recipientUserId) return null;
  const [user, preference, workspace, membership, workspaceSettings] = await Promise.all([
    prisma.user.findUnique({
      where: { id: notification.recipientUserId },
      select: { id: true, email: true },
    }),
    prisma.notificationPreference.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: notification.workspaceId,
          userId: notification.recipientUserId,
        },
      },
    }),
    prisma.workspace.findFirst({
      where: { id: notification.workspaceId, organizationId: notification.organizationId },
      select: { id: true, organizationId: true },
    }),
    prisma.membership.findFirst({
      where: {
        userId: notification.recipientUserId,
        organizationId: notification.organizationId,
      },
      select: { id: true },
    }),
    prisma.workspaceSettings.findUnique({
      where: { workspaceId: notification.workspaceId },
      select: { notificationsEnabled: true },
    }),
  ]);
  if (!user || !workspace || !membership) return null;
  return {
    email: user.email,
    preference: preference ?? {
      inAppEnabled: true,
      emailEnabled: false,
      quietHoursStart: null,
      quietHoursEnd: null,
      timezone: "UTC",
    },
    notificationsEnabled: workspaceSettings?.notificationsEnabled ?? true,
  };
}

async function finishWithoutDelivery(
  notification: ClaimedNotification,
  workerId: string,
  data: { status: "CANCELLED" | "QUEUED"; reason: string; scheduledFor?: Date },
) {
  await prisma.complianceNotification.updateMany({
    where: { id: notification.id, status: "PROCESSING", lockedBy: workerId },
    data: {
      status: data.status,
      failureReason: data.reason,
      ...(data.scheduledFor ? { scheduledFor: data.scheduledFor, nextAttemptAt: data.scheduledFor } : {}),
      lockedAt: null,
      lockedBy: null,
    },
  });
}

async function beginAttempt(notification: ClaimedNotification, workerId: string, now: Date) {
  return prisma.$transaction(async (transaction) => {
    const claimed = await transaction.complianceNotification.updateMany({
      where: { id: notification.id, status: "PROCESSING", lockedBy: workerId },
      data: { attemptCount: { increment: 1 }, lastAttemptAt: now },
    });
    if (claimed.count !== 1) return null;
    const current = await transaction.complianceNotification.findUniqueOrThrow({
      where: { id: notification.id },
      select: { attemptCount: true },
    });
    const attempt = await transaction.notificationDeliveryAttempt.create({
      data: {
        notificationId: notification.id,
        attemptNumber: current.attemptCount,
        status: "ATTEMPTING",
        startedAt: now,
      },
    });
    return { id: attempt.id, attemptNumber: current.attemptCount };
  });
}

async function finishAttempt(input: {
  notification: ClaimedNotification;
  workerId: string;
  attemptId: string;
  now: Date;
  success?: { messageId: string; receipt: string };
  error?: unknown;
}) {
  const { notification, workerId, attemptId, now } = input;
  if (input.success) {
    await prisma.$transaction([
      prisma.notificationDeliveryAttempt.update({
        where: { id: attemptId },
        data: {
          status: "ACCEPTED",
          completedAt: now,
          providerMessageId: input.success.messageId,
        },
      }),
      prisma.complianceNotification.updateMany({
        where: { id: notification.id, status: "PROCESSING", lockedBy: workerId },
        data: {
          status: "SENT",
          sentAt: now,
          failureReason: null,
          providerMessageId: input.success.messageId,
          deliveryReceipt: input.success.receipt,
          lockedAt: null,
          lockedBy: null,
        },
      }),
    ]);
    return "delivered" as const;
  }

  const code = failureCode(input.error);
  const permanent = isPermanentFailure(input.error);
  const deadLetter = permanent || notification.attemptCount + 1 >= notification.maxAttempts;
  const status = deadLetter ? "DEAD_LETTER" : "QUEUED";
  const retryDate = deadLetter ? null : retryAt(now, notification.attemptCount + 1);
  const safeMessage = `Notification delivery failed (${code}).`;
  await prisma.$transaction([
    prisma.notificationDeliveryAttempt.update({
      where: { id: attemptId },
      data: {
        status: deadLetter ? "PERMANENT_FAILURE" : "RETRYABLE_FAILURE",
        completedAt: now,
        failureCode: code,
        failureMessage: safeMessage,
      },
    }),
    prisma.complianceNotification.updateMany({
      where: { id: notification.id, status: "PROCESSING", lockedBy: workerId },
      data: {
        status,
        failedAt: now,
        failureReason: safeMessage,
        ...(retryDate ? { nextAttemptAt: retryDate } : { deadLetteredAt: now }),
        lockedAt: null,
        lockedBy: null,
      },
    }),
  ]);
  return deadLetter ? "deadLettered" as const : "retried" as const;
}

export async function runNotificationWorker(
  now = new Date(),
  requestedLimit = 50,
) {
  const limit = Math.max(1, Math.min(MAX_BATCH_SIZE, Math.floor(requestedLimit)));
  const workerId = randomUUID();
  const claimed = await claimDueNotifications(now, workerId, limit);
  const summary = {
    claimed: claimed.length,
    delivered: 0,
    retried: 0,
    deadLettered: 0,
    cancelled: 0,
    deferred: 0,
    failed: 0,
  };

  for (const notification of claimed) {
    try {
      const recipient = await loadRecipientContext(notification);
      if (!recipient || !recipient.notificationsEnabled ||
        (notification.channel === "IN_APP" && !recipient.preference.inAppEnabled) ||
        (notification.channel === "EMAIL" && !recipient.preference.emailEnabled)) {
        await finishWithoutDelivery(notification, workerId, {
          status: "CANCELLED",
          reason: !recipient ? "RECIPIENT_NOT_IN_WORKSPACE" : "RECIPIENT_PREFERENCE_DISABLED",
        });
        summary.cancelled += 1;
        continue;
      }

      const quietUntil = quietHoursEnd(
        now,
        recipient.preference.quietHoursStart,
        recipient.preference.quietHoursEnd,
        recipient.preference.timezone,
      );
      if (notification.channel === "EMAIL" && quietUntil) {
        await finishWithoutDelivery(notification, workerId, {
          status: "QUEUED",
          reason: "DEFERRED_DURING_QUIET_HOURS",
          scheduledFor: quietUntil,
        });
        summary.deferred += 1;
        continue;
      }

      const attempt = await beginAttempt(notification, workerId, now);
      if (!attempt) continue;
      if (notification.channel === "IN_APP") {
        const result = await finishAttempt({
          notification,
          workerId,
          attemptId: attempt.id,
          now,
          success: { messageId: `in-app:${notification.id}`, receipt: "Persisted in recipient inbox." },
        });
        summary[result] += 1;
        continue;
      }

      try {
        const receipt = await sendNotificationEmail({
          id: notification.id,
          templateKey: notification.templateKey,
          templateVersion: notification.templateVersion,
          subject: notification.subject,
          body: notification.body,
          recipientEmail: recipient.email,
        });
        summary.delivered += await finishAttempt({
          notification,
          workerId,
          attemptId: attempt.id,
          now,
          success: { messageId: receipt.messageId, receipt: receipt.response },
        }).then(() => 1);
      } catch (error) {
        console.error("Notification delivery attempt failed.", {
          notificationId: notification.id,
          failureCode: failureCode(error),
        });
        summary[await finishAttempt({
          notification,
          workerId,
          attemptId: attempt.id,
          now,
          error,
        })] += 1;
      }
    } catch (error) {
      summary.failed += 1;
      console.error("Unable to process notification.", {
        notificationId: notification.id,
        failureCode: failureCode(error),
      });
    }
  }

  return summary;
}
