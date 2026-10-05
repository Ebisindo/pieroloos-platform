import { NextResponse } from "next/server";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { prisma } from "@/lib/db/prisma";
import { attachCrossBorderEvidenceSchema } from "@/lib/validation/cross-border";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; controlId: string }> },
) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("documents:write")) {
    return NextResponse.json({ error: "Document write permission required." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = attachCrossBorderEvidenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A document and current dossier version are required." }, { status: 422 });
  }
  const { id, controlId } = await params;
  const principal = context.principal;
  const dossier = await prisma.crossBorderDossier.findFirst({
    where: { id, workspaceId: principal.workspaceId },
    select: {
      id: true,
      clientId: true,
      version: true,
      status: true,
      controls: {
        where: { id: controlId },
        select: {
          id: true,
          evidence: { where: { documentId: parsed.data.documentId }, select: { id: true } },
        },
      },
    },
  });
  if (!dossier) return NextResponse.json({ error: "Cross-border dossier not found." }, { status: 404 });
  if (dossier.version !== parsed.data.expectedVersion) {
    return NextResponse.json({ error: "Dossier changed. Refresh before retrying." }, { status: 409 });
  }
  if (dossier.status === "ARCHIVED" || dossier.status === "REVIEWED") {
    return NextResponse.json({ error: "Evidence cannot be changed on a reviewed or archived dossier." }, { status: 409 });
  }
  const control = dossier.controls[0];
  if (!control) return NextResponse.json({ error: "Dossier control not found." }, { status: 404 });
  if (control.evidence.length) return NextResponse.json({ error: "This document is already linked to the control." }, { status: 409 });
  const document = await prisma.document.findFirst({
    where: {
      id: parsed.data.documentId,
      workspaceId: principal.workspaceId,
      clientId: dossier.clientId,
    },
    select: { id: true },
  });
  if (!document) return NextResponse.json({ error: "Evidence document was not found for this client and workspace." }, { status: 404 });

  const result = await withAuthorizedWorkspaceTransaction(principal, "documents:write", async (transaction) => {
    const updated = await transaction.crossBorderDossier.updateMany({
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
    if (!updated.count) return null;
    const evidence = await transaction.crossBorderControlEvidence.create({
      data: {
        controlId: control.id,
        documentId: document.id,
        linkedByUserId: principal.userId,
      },
    });
    await transaction.crossBorderDossierAuditEvent.create({
      data: {
        dossierId: dossier.id,
        workspaceId: principal.workspaceId,
        actorUserId: principal.userId,
        eventType: "CONTROL_EVIDENCE_LINKED",
        details: { controlId: control.id, documentId: document.id },
      },
    });
    return evidence;
  });
  if (!result) return NextResponse.json({ error: "Dossier changed. Refresh and retry." }, { status: 409 });
  return NextResponse.json({ data: result }, { status: 201 });
}
