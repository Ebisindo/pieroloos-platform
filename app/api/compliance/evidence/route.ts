import { NextResponse } from "next/server";

// This endpoint is deliberately disabled until an authenticated, workspace-scoped
// evidence repository and authorization contract are implemented. Do not return
// fixture data from a live API route.
export async function GET() {
  return NextResponse.json(
    { error: "Compliance evidence portfolio is not configured." },
    { status: 501 },
  );
}
