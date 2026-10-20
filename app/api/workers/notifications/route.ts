import { NextResponse } from "next/server";
import { hasValidWorkerSecret } from "@/lib/auth/worker-secret";
import { prisma } from "@/lib/db/prisma";
import { runNotificationWorker } from "@/lib/services/notification-worker";

export const runtime = "nodejs";

function isConfigured() {
  return Boolean(process.env.OPERATIONAL_WORKER_SECRET?.trim());
}

function isAuthorized(request: Request) {
  return hasValidWorkerSecret(request, "OPERATIONAL_WORKER_SECRET");
}

export async function POST(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Operational worker is not configured." }, { status: 503 });
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const requestedLimit = Number(new URL(request.url).searchParams.get("limit") ?? "10");
    if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100) {
      return NextResponse.json({ error: "Batch limit must be an integer between 1 and 100." }, { status: 400 });
    }
    const result = await runNotificationWorker(new Date(), requestedLimit);
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Notification worker batch failed.", error);
    return NextResponse.json({ error: "Notification worker batch failed." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "Operational worker is not configured." }, { status: 503 });
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const [statuses, oldestQueued, deadLetterCount] = await Promise.all([
      prisma.complianceNotification.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.complianceNotification.findFirst({
        where: { status: "QUEUED" },
        orderBy: { scheduledFor: "asc" },
        select: { scheduledFor: true },
      }),
      prisma.complianceNotification.count({ where: { status: "DEAD_LETTER" } }),
    ]);
    return NextResponse.json({
      data: {
        countsByStatus: Object.fromEntries(statuses.map(({ status, _count }) => [status, _count._all])),
        oldestQueuedAt: oldestQueued?.scheduledFor ?? null,
        deadLetterCount,
      },
    });
  } catch (error) {
    console.error("Unable to read notification worker status.", error);
    return NextResponse.json({ error: "Unable to read notification worker status." }, { status: 500 });
  }
}
