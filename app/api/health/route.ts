import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

// Liveness plus database reachability. Exposes no configuration or tenant data.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Health check failed: database unreachable.", error);
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}
