import { NextResponse } from "next/server";
import { formationRepository } from "@/lib/db/formation-repository";
import { workingJurisdictionDecisionSchema } from "@/lib/validation/formation";

export async function POST(request: Request) {
  const parsed = workingJurisdictionDecisionSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid working jurisdiction decision", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const decision = await formationRepository.createWorkingJurisdictionDecision(parsed.data);

  return NextResponse.json({ data: decision }, { status: 201 });
}
