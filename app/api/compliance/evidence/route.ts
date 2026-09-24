import { NextResponse } from "next/server";
import { buildObligationEvidenceView } from "@/lib/services/evidence-intelligence";

export async function GET() {
  // Replace fixture with authenticated repository query.
  const view = buildObligationEvidenceView("example-obligation", []);
  return NextResponse.json({ data: view });
}
