import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { prisma } from "@/lib/db/prisma";
import { createCrossBorderControlSchema } from "@/lib/validation/cross-border";

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
  if (!context.principal.permissions.includes("compliance:write")) {
    return NextResponse.json({ error: "Cross-border dossier write permission required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = createCrossBorderControlSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid preparation control.", issues: parsed.error.flatten() }, { status: 422 });
  }
  const { id } = await params;
  const principal = context.principal;
  const dossier = await prisma.crossBorderDossier.findFirst({
    where: { id, workspaceId: principal.workspaceId },
    select: { id: true, clientId: true, status: true, version: true },
  });
  if (!dossier) return NextResponse.json({ error: "Cross-border dossier not found." }, { status: 404 });
  if (dossier.status === "ARCHIVED" || dossier.status === "REVIEWED") {
    return NextResponse.json({ error: "Controls cannot be changed on a reviewed or archived dossier." }, { status: 409 });
  }

  if (dossier.version !== parsed.data.expectedVersion) {
    return NextResponse.json({ error: "Dossier changed. Refresh before retrying." }, { status: 409 });
  }

  const result = await prisma.$transaction(async (transaction) => {
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
    const control = await transaction.crossBorderDossierControl.create({
      data: {
        dossierId: dossier.id,
        category: parsed.data.category,
        title: parsed.data.title,
        description: parsed.data.description || null,
        requiresEvidence: parsed.data.requiresEvidence,
        createdByUserId: principal.userId,
      },
      include: { evidence: { include: { document: { select: { id: true, name: true } } } } },
    });
    await transaction.crossBorderDossierAuditEvent.create({
      data: {
        dossierId: dossier.id,
        workspaceId: principal.workspaceId,
        actorUserId: principal.userId,
        eventType: "CONTROL_ADDED",
        details: { controlId: control.id, category: control.category, title: control.title },
      },
    });
    return control;
  });
  if (!result) return NextResponse.json({ error: "Dossier changed. Refresh and retry." }, { status: 409 });
  return NextResponse.json({ data: result }, { status: 201 });
}
