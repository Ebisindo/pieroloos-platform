import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { createCorrelationId, logOperationalEvent } from "@/lib/observability/logger";

export const dynamic = "force-dynamic";

// Dependency readiness probe. Exposes no configuration or tenant data.
export async function GET() {
  const correlationId = createCorrelationId();
  const startedAt = Date.now();

  try {
    await prisma.$queryRaw`SELECT 1`;
    logOperationalEvent({
      event: "health_check_succeeded",
      level: "info",
      correlationId,
      dependency: "database",
      outcome: "ok",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { status: "ok", correlationId },
      { headers: { "x-correlation-id": correlationId } },
    );
  } catch {
    // Do not serialize exception objects: driver errors can contain hostnames,
    // query fragments, or other deployment details.
    logOperationalEvent({
      event: "health_check_failed",
      level: "error",
      correlationId,
      dependency: "database",
      outcome: "degraded",
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { status: "degraded", correlationId },
      { status: 503, headers: { "x-correlation-id": correlationId } },
    );
  }
}
