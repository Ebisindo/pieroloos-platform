import { NextResponse } from "next/server";
import { jurisdictionRepository } from "@/lib/db/jurisdiction-repository";
import { comparisonRepository } from "@/lib/db/comparison-repository";
import { compareJurisdictions } from "@/lib/services/jurisdiction-engine";
import { comparisonRequestSchema } from "@/lib/validation/jurisdiction";

export async function POST(req: Request) {
  try {
    const parsed = comparisonRequestSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid comparison request", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const jurisdictions = await jurisdictionRepository.list();
    const results = compareJurisdictions(parsed.data, jurisdictions);

    const snapshot = await comparisonRepository.create({
      businessProfileId: parsed.data.businessProfileId,
      methodologyVersion: parsed.data.methodologyVersion,
      criteriaJson: parsed.data.criteria,
      jurisdictionIds: parsed.data.jurisdictionIds,
      resultsJson: results,
    });

    return NextResponse.json(
      { data: { snapshot, results } },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Comparison failed." },
      { status: 400 },
    );
  }
}
