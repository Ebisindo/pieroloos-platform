import { NextResponse } from "next/server";
import { controlCenterQuerySchema } from "@/lib/validation/compliance-control";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = controlCenterQuerySchema.safeParse(Object.fromEntries(url.searchParams));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid control-center query", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Replace with authenticated repository/service integration before production.
  return NextResponse.json({
    data: {
      generatedAt: new Date().toISOString(),
      filters: parsed.data,
      snapshot: {
        portfolioStatus: "HEALTHY",
        progressPercent: 0,
        totals: {
          obligations: 0, compliant: 0, dueSoon: 0, overdue: 0,
          blocked: 0, awaitingEvidence: 0, awaitingReview: 0,
        },
        alerts: [],
      },
    },
  });
}
