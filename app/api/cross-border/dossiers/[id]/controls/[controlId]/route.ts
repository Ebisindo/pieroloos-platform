import { NextResponse } from "next/server";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { prisma } from "@/lib/db/prisma";
import { updateCrossBorderControlSchema } from "@/lib/validation/cross-border";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; controlId: string }> },
) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("compliance:write")) {
    return NextResponse.json({ error: "Cross-border dossier write permission required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = updateCrossBorderControlSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid control status and dossier version are required." }, { status: 422 });
  }
  const { id, controlId } = await params;
  const principal = context.principal;
  const dossier = await prisma.crossBorderDossier.findFirst({
    where: { id, workspaceId: principal.workspaceId },
    select: {
      id: true,
      version: true,
      status: true,
      controls: {
        where: { id: controlId },
        select: { id: true, status: true, requiresEvidence: true, _count: { select: { evidence: true } } },
      },
    },
  });
  if (!dossier) return NextResponse.json({ error: "Cross-border dossier not found." }, { status: 404 });
  if (dossier.version !== parsed.data.expectedVersion) {
    return NextResponse.json({ error: "Dossier changed. Refresh before retrying." }, { status: 409 });
  }
  const control = dossier.controls[0];
  if (!control) return NextResponse.json({ error: "Dossier control not found." }, { status: 404 });
  if (dossier.status === "ARCHIVED" || dossier.status === "REVIEWED") {
    return NextResponse.json({ error: "Controls cannot be changed on a reviewed or archived dossier." }, { status: 409 });
  }
  if (parsed.data.status === "COMPLETE" && control.requiresEvidence && control._count.evidence === 0) {
    return NextResponse.json({ error: "Attach evidence before completing this control." }, { status: 409 });
  }

  const now = new Date();
  const result = await withAuthorizedWorkspaceTransaction(principal, "compliance:write", async (transaction) => {
    const updatedDossier = await transaction.crossBorderDossier.updateMany({
      where: { id, workspaceId: principal.workspaceId, version: parsed.data.expectedVersion },
      data: {
        version: { increment: 1 },
        status: dossier.status === "CHANGES_REQUESTED" ? "PREPARING" : dossier.status,
        ...(dossier.status === "CHANGES_REQUESTED" ? {
          reviewedByUserId: null,
          reviewNote: null,
          reviewedAt: null,
        } : {}),
      },
    });
    if (!updatedDossier.count) return null;
    const updated = await transaction.crossBorderDossierControl.update({
      where: { id: control.id },
      data: { status: parsed.data.status },
    });
    await transaction.crossBorderDossierAuditEvent.create({
      data: {
        dossierId: dossier.id,
        workspaceId: principal.workspaceId,
        actorUserId: principal.userId,
        eventType: "CONTROL_STATUS_CHANGED",
        details: { controlId: control.id, from: control.status, to: parsed.data.status, occurredAt: now.toISOString() },
        occurredAt: now,
      },
    });
    return updated;
  });
  if (!result) return NextResponse.json({ error: "Dossier changed. Refresh and retry." }, { status: 409 });
  return NextResponse.json({ data: result });
}
