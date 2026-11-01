import { NextResponse } from "next/server";
import { hasValidWorkerSecret } from "@/lib/auth/worker-secret";
import { runSuccessorContinuityWorker } from "@/lib/services/successor-continuity-worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!process.env.OPERATIONAL_WORKER_SECRET) return NextResponse.json({ error: "Operational worker is not configured." }, { status: 503 });
  if (!hasValidWorkerSecret(request, "OPERATIONAL_WORKER_SECRET")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  try {
    return NextResponse.json({ data: await runSuccessorContinuityWorker() });
  } catch {
    return NextResponse.json({ error: "Successor continuity worker failed." }, { status: 500 });
  }
}
