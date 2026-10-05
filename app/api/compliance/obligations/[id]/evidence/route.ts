import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { prisma } from "@/lib/db/prisma";
import { addComplianceEvidenceSchema } from "@/lib/validation/compliance";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, routeContext: RouteContext) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const context = await getWorkspaceContext();
  if (!context.userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!context.principal) return NextResponse.json({ error: "Select an active workspace." }, { status: 409 });
  if (!context.principal.permissions.includes("documents:write")) {
    return NextResponse.json({ error: "Document write permission required." }, { status: 403 });
  }
  const principal = context.principal;

  const { id } = await routeContext.params;
  const parsed = addComplianceEvidenceSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid compliance evidence.", issues: parsed.error.flatten() }, { status: 422 });
  }
  const obligation = await prisma.complianceObligation.findFirst({
    where: { id, workspaceId: principal.workspaceId },
    select: { id: true, clientId: true },
  });
  if (!obligation) return NextResponse.json({ error: "Compliance obligation not found." }, { status: 404 });
  const document = await prisma.document.findFirst({
    where: { id: parsed.data.documentId, workspaceId: principal.workspaceId, clientId: obligation.clientId },
    select: { id: true },
  });
  if (!document) return NextResponse.json({ error: "Document not found for this client and workspace." }, { status: 404 });

  const validThrough = parsed.data.validThrough
    ? new Date(Date.UTC(
        parsed.data.validThrough.getUTCFullYear(),
        parsed.data.validThrough.getUTCMonth(),
        parsed.data.validThrough.getUTCDate(),
        23,
        59,
        59,
        999,
      ))
    : null;
  const evidence = await prisma.$transaction(async (transaction) => {
    const created = await transaction.complianceEvidence.create({
      data: {
        obligationId: obligation.id,
        documentId: document.id,
        evidenceClass: parsed.data.evidenceClass,
        note: parsed.data.note,
        sourceReference: parsed.data.sourceReference || null,
        validThrough,
      },
    });
    await transaction.complianceActivity.create({
      data: {
        obligationId: obligation.id,
        action: "EVIDENCE_ATTACHED",
        actorUserId: principal.userId,
        note: parsed.data.note,
        metadata: {
          evidenceId: created.id,
          documentId: document.id,
          sourceReference: created.sourceReference,
          validThrough: created.validThrough?.toISOString() ?? null,
        },
      },
    });
    return created;
  });

  return NextResponse.json({ data: evidence }, { status: 201 });
}
