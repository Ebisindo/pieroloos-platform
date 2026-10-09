import { NextResponse } from "next/server";
import { hasValidWorkerSecret } from "@/lib/auth/worker-secret";
import { prisma } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!process.env.OPERATIONAL_WORKER_SECRET?.trim()) {
    return NextResponse.json({ error: "Operational worker is not configured." }, { status: 503 });
  }
  if (!hasValidWorkerSecret(request, "OPERATIONAL_WORKER_SECRET")) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const result = await prisma.$transaction(async (transaction) => {
      const notification = await transaction.complianceNotification.findFirst({
        where: { id, status: "DEAD_LETTER" },
        select: {
          id: true,
          workspaceId: true,
          attemptCount: true,
          maxAttempts: true,
          failureReason: true,
        },
      });
      if (!notification) return "NOT_FOUND_OR_NOT_DEAD_LETTER";

      const now = new Date();
      const updated = await transaction.complianceNotification.updateMany({
        where: { id: notification.id, status: "DEAD_LETTER" },
        data: {
          status: "QUEUED",
          maxAttempts: { increment: 5 },
          deadLetteredAt: null,
          failedAt: null,
          nextAttemptAt: now,
          scheduledFor: now,
          failureReason: "Operator-authorized dead-letter replay.",
        },
      });
      if (updated.count !== 1) return "CONCURRENT_UPDATE";

      await transaction.activity.create({
        data: {
          workspaceId: notification.workspaceId,
          type: "SYSTEM",
          title: "Dead-lettered notification requeued",
          summary: "An authorized worker operator requeued a notification for another bounded delivery cycle.",
          metadata: {
            notificationId: notification.id,
            priorAttemptCount: notification.attemptCount,
            priorMaxAttempts: notification.maxAttempts,
            priorFailureReason: notification.failureReason,
          },
        },
      });
      return "REQUEUED";
    });

    if (result === "NOT_FOUND_OR_NOT_DEAD_LETTER") {
      return NextResponse.json({ error: "Dead-lettered notification not found." }, { status: 404 });
    }
    if (result === "CONCURRENT_UPDATE") {
      return NextResponse.json({ error: "Notification state changed; refresh before retrying." }, { status: 409 });
    }
    return NextResponse.json({ data: { id, status: result } });
  } catch (error) {
    console.error("Unable to requeue dead-lettered notification.", error);
    return NextResponse.json({ error: "Unable to requeue notification." }, { status: 500 });
  }
}
