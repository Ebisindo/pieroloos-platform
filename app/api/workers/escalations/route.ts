import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { runOperationalEscalationWorker } from "@/lib/services/operational-escalation-worker";

export const runtime = "nodejs";

function hasValidWorkerSecret(request: Request) {
  const expected = process.env.OPERATIONAL_WORKER_SECRET;
  const authorization = request.headers.get("authorization");
  if (!expected || !authorization?.startsWith("Bearer ")) return false;

  const provided = authorization.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length
    && timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request: Request) {
  if (!process.env.OPERATIONAL_WORKER_SECRET) {
    return NextResponse.json({ error: "Operational worker is not configured." }, { status: 503 });
  }
  if (!hasValidWorkerSecret(request)) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const result = await runOperationalEscalationWorker();
  return NextResponse.json({ data: result });
}
