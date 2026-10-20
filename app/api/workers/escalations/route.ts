import { NextResponse } from "next/server";
import { hasValidWorkerSecret } from "@/lib/auth/worker-secret";
import { runOperationalEscalationWorker } from "@/lib/services/operational-escalation-worker";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.OPERATIONAL_WORKER_SECRET) {
    return NextResponse.json({ error: "Operational worker is not configured." }, { status: 503 });
  }
  if (!hasValidWorkerSecret(request, "OPERATIONAL_WORKER_SECRET")) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const result = await runOperationalEscalationWorker();
  return NextResponse.json({ data: result });
}
