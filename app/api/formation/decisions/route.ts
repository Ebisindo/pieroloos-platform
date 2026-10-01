import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { formationRepository } from "@/lib/db/formation-repository";
import { prisma } from "@/lib/db/prisma";
import { workingJurisdictionDecisionSchema } from "@/lib/validation/formation";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("formation:write")) {
    return NextResponse.json({ error: "Formation write permission required." }, { status: 403 });
  }

  const parsed = workingJurisdictionDecisionSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid working jurisdiction decision.", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const principal = context.principal;
  const comparison = await prisma.jurisdictionComparison.findFirst({
    where: { id: parsed.data.comparisonSnapshotId, workspaceId: principal.workspaceId },
    select: { id: true, businessProfileId: true, jurisdictionIdsJson: true },
  });
  if (!comparison?.businessProfileId) {
    return NextResponse.json({ error: "Comparison with a business profile not found in this workspace." }, { status: 404 });
  }

  let jurisdictionIds: unknown;
  try {
    jurisdictionIds = JSON.parse(comparison.jurisdictionIdsJson);
  } catch {
    return NextResponse.json({ error: "Comparison snapshot has invalid jurisdiction data." }, { status: 422 });
  }
  if (!Array.isArray(jurisdictionIds) || !jurisdictionIds.includes(parsed.data.jurisdictionId)) {
    return NextResponse.json({ error: "Selected jurisdiction was not part of this comparison." }, { status: 422 });
  }

  const profile = await prisma.businessProfile.findFirst({
    where: { id: comparison.businessProfileId, client: { workspaceId: principal.workspaceId } },
    select: { id: true },
  });
  if (!profile) return NextResponse.json({ error: "Business profile not found in this workspace." }, { status: 404 });
  const jurisdiction = await prisma.jurisdiction.findFirst({
    where: { id: parsed.data.jurisdictionId, OR: [{ workspaceId: principal.workspaceId }, { workspaceId: null }] },
    select: { id: true },
  });
  if (!jurisdiction) return NextResponse.json({ error: "Selected jurisdiction is not available." }, { status: 404 });

  const decision = await formationRepository.createWorkingJurisdictionDecision({
    workspaceId: principal.workspaceId,
    businessProfileId: profile.id,
    comparisonSnapshotId: comparison.id,
    jurisdictionId: jurisdiction.id,
    rationale: parsed.data.rationale,
    decidedByUserId: principal.userId,
    professionalReviewRequired: true,
    professionalReviewCompleted: false,
  });

  return NextResponse.json({ data: decision }, { status: 201 });
}
