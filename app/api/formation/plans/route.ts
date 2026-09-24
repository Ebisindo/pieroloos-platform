import { NextResponse } from "next/server";
import { formationPlanCreateSchema } from "@/lib/validation/formation";
import { createFormationPlan } from "@/lib/services/formation-engine";

export async function POST(request: Request) {
  const parsed = formationPlanCreateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid formation plan request", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const plan = createFormationPlan({
    id: `plan-${crypto.randomUUID()}`,
    clientId: parsed.data.clientId,
    businessProfileId: parsed.data.businessProfileId,
    comparisonSnapshotId: parsed.data.comparisonSnapshotId,
    decision: {
      id: parsed.data.decisionId,
      businessProfileId: parsed.data.businessProfileId,
      comparisonSnapshotId: parsed.data.comparisonSnapshotId,
      jurisdictionId: parsed.data.jurisdictionId,
      decidedByUserId: "current-user",
      decidedAt: new Date().toISOString(),
      professionalReviewRequired: true,
      professionalReviewCompleted: false,
    },
    jurisdictionName: parsed.data.jurisdictionName,
    methodologyVersion: parsed.data.methodologyVersion,
  });

  return NextResponse.json({ data: plan }, { status: 201 });
}
