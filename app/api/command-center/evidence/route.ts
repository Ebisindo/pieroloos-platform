import { NextResponse } from "next/server";
import { buildCommandCenterSnapshot } from "@/lib/services/command-center-service";

export async function GET() {
  // Replace fixtures with authenticated workspace repositories.
  return NextResponse.json({ data: buildCommandCenterSnapshot({ documents: [], obligationIds: [] }) });
}
