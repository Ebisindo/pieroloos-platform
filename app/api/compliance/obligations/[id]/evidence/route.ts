import { NextResponse } from "next/server";
import { withAuthorizedWorkspaceTransaction } from "@/lib/auth/authorized-workspace-transaction";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { getWorkspaceContext } from "@/lib/auth/workspace-context";
import { addComplianceEvidenceSchema } from "@/lib/validation/compliance";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, routeContext: RouteContext) {
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
  const parsed = addComplianceEvidenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid compliance evidence.", issues: parsed.error.flatten() }, { status: 422 });
  }

  const principal = context.principal;
  const { id } = await routeContext.params;
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

  try {
    const evidence = await withAuthorizedWorkspaceTransaction(principal, "documents:write", async (transaction) => {
      const obligation = await transaction.complianceObligation.findFirst({
        where: {
          id,
          organizationId: principal.organizationId,
          workspaceId: principal.workspaceId,
        },
        select: { id: true, clientId: true },
      });
      if (!obligation) throw new Error("COMPLIANCE_OBLIGATION_NOT_FOUND");

      const document = await transaction.document.findFirst({
        where: {
          id: parsed.data.documentId,
          workspaceId: principal.workspaceId,
          clientId: obligation.clientId,
          status: "AVAILABLE",
          scanStatus: "CLEAN",
          deletedAt: null,
        },
        select: { id: true },
      });
      if (!document) throw new Error("COMPLIANCE_EVIDENCE_DOCUMENT_NOT_FOUND");

      const created = await transaction.complianceEvidence.create({
        data: {
          obligationId: obligation.id,
          documentId: document.id,
          workspaceId: principal.workspaceId,
          evidenceClass: parsed.data.evidenceClass,
          note: parsed.data.note,
          sourceReference: parsed.data.sourceReference || null,
          validThrough,
        },
      });
      await transaction.documentAccessEvent.create({
        data: {
          documentId: document.id,
          workspaceId: principal.workspaceId,
          actorUserId: principal.userId,
          action: "EVIDENCE_LINKED",
          metadata: { obligationId: obligation.id, complianceEvidenceId: created.id },
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
  } catch (error) {
    if (error instanceof Error && error.message === "WORKSPACE_AUTHORIZATION_STALE") {
      return NextResponse.json({ error: "Workspace authorization changed. Refresh and try again." }, { status: 409 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_OBLIGATION_NOT_FOUND") {
      return NextResponse.json({ error: "Compliance obligation not found." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "COMPLIANCE_EVIDENCE_DOCUMENT_NOT_FOUND") {
      return NextResponse.json({ error: "Document not found for this client and workspace." }, { status: 404 });
    }
    console.error("Compliance evidence attachment failed.", error);
    return NextResponse.json({ error: "Unable to attach compliance evidence." }, { status: 500 });
  }
}
