import { NextResponse } from "next/server";

// This endpoint remains disabled until an authenticated, workspace-scoped
// evidence repository and authorization contract are implemented. Never return
// fixture evidence from a live API route.
export async function GET() {
  return NextResponse.json(
    { error: "Compliance evidence portfolio is not configured." },
    { status: 501 },
  );
}
