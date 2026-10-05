import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { isCrossBorderDossierReadyForReview } from "@/lib/domain/cross-border";
import { prisma } from "@/lib/db/prisma";
import { reviewCrossBorderDossierSchema } from "@/lib/validation/cross-border";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("documents:review")) {
    return NextResponse.json({ error: "Professional review permission required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = reviewCrossBorderDossierSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A review outcome, note, and current version are required." }, { status: 422 });
  }
  const { id } = await params;
  const principal = context.principal;
  const dossier = await prisma.crossBorderDossier.findFirst({
    where: { id, workspaceId: principal.workspaceId },
    select: {
      id: true,
      version: true,
      status: true,
      controls: {
        select: { status: true, requiresEvidence: true, _count: { select: { evidence: true } } },
      },
    },
  });
  if (!dossier) return NextResponse.json({ error: "Cross-border dossier not found." }, { status: 404 });
  if (dossier.version !== parsed.data.expectedVersion) {
    return NextResponse.json({ error: "Dossier changed. Refresh before retrying." }, { status: 409 });
  }
  if (dossier.status === "ARCHIVED" || dossier.status === "REVIEWED") {
    return NextResponse.json({ error: "This dossier is already reviewed or archived." }, { status: 409 });
  }
  const controlsReady = isCrossBorderDossierReadyForReview(dossier.controls.map((control) => ({
    status: control.status,
    requiresEvidence: control.requiresEvidence,
    evidenceCount: control._count.evidence,
  })));
  if (parsed.data.status === "REVIEWED" && !controlsReady) {
    return NextResponse.json({ error: "Complete all controls and attach required evidence before recording review." }, { status: 409 });
  }

  const reviewedAt = new Date();
  const result = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.crossBorderDossier.updateMany({
      where: {
        id,
        workspaceId: principal.workspaceId,
        version: parsed.data.expectedVersion,
        status: { not: "ARCHIVED" },
      },
      data: {
        status: parsed.data.status,
        version: { increment: 1 },
        reviewedByUserId: principal.userId,
        reviewNote: parsed.data.note,
        reviewedAt,
        updatedAt: reviewedAt,
      },
    });
    if (!updated.count) return null;
    const record = await transaction.crossBorderDossier.findFirst({
      where: { id, workspaceId: principal.workspaceId },
    });
    if (!record) return null;
    await transaction.crossBorderDossierAuditEvent.create({
      data: {
        dossierId: id,
        workspaceId: principal.workspaceId,
        actorUserId: principal.userId,
        eventType: "DOSSIER_REVIEW_RECORDED",
        details: { status: parsed.data.status, note: parsed.data.note, version: record.version },
        occurredAt: reviewedAt,
      },
    });
    return record;
  });
  if (!result) return NextResponse.json({ error: "Dossier changed. Refresh and retry." }, { status: 409 });
  return NextResponse.json({ data: result });
}
