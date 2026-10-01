import { NextResponse } from "next/server";
import { jurisdictionRepository } from "@/lib/db/jurisdiction-repository";
import { comparisonRepository } from "@/lib/db/comparison-repository";
import { compareJurisdictions } from "@/lib/services/jurisdiction-engine";
import { comparisonRequestSchema } from "@/lib/validation/jurisdiction";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(req.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("jurisdictions:write")) {
    return NextResponse.json({ error: "Jurisdiction comparison permission required." }, { status: 403 });
  }

  try {
    const parsed = comparisonRequestSchema.safeParse(await req.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid comparison request", issues: parsed.error.flatten() },
        { status: 422 },
      );
    }

    if (parsed.data.businessProfileId) {
      const profile = await prisma.businessProfile.findFirst({
        where: {
          id: parsed.data.businessProfileId,
          client: { workspaceId: context.principal.workspaceId },
        },
        select: { id: true },
      });
      if (!profile) {
        return NextResponse.json({ error: "Business profile not found in this workspace." }, { status: 404 });
      }
    }

    const jurisdictions = await jurisdictionRepository.list(context.principal.workspaceId);
    const results = compareJurisdictions(parsed.data, jurisdictions);

    const snapshot = await comparisonRepository.create({
      workspaceId: context.principal.workspaceId,
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
