import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getAuthenticatedUserId } from "@/lib/auth/professional-partner-session";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { withProfessionalPartnerGrantTransaction, isPartnerGrantDenied } from "@/lib/auth/professional-partner-grant";
import { partnerEvidenceAttachSchema } from "@/lib/validation/professional-partner";

type RouteContext = { params: Promise<{ clientId: string }> };
const closedStatuses = new Set<string>(["COMPLETE", "COMPLETED", "COMPLIANT", "WAIVED", "NOT_APPLICABLE"]);

export async function POST(request: Request, { params }: RouteContext) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const userId = await getAuthenticatedUserId();
  if (!userId) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const { clientId } = await params;
  const parsed = partnerEvidenceAttachSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid evidence attachment request.", issues: parsed.error.flatten() }, { status: 422 });
  if (parsed.data.sourceReference && /^[a-z][a-z0-9+.-]*:/i.test(parsed.data.sourceReference)) {
    try {
      const source = new URL(parsed.data.sourceReference);
      if (source.protocol !== "https:" || source.username || source.password) {
        return NextResponse.json({ error: "Source references must use HTTPS and must not contain embedded credentials." }, { status: 422 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid source reference." }, { status: 422 });
    }
  }

  const input = parsed.data;
  try {
    const result = await withProfessionalPartnerGrantTransaction({
      userId,
      clientId,
      capability: "EVIDENCE_ATTACH",
      action: "PARTNER_EVIDENCE_ATTACHMENT_REQUEST",
      resourceId: input.obligationId,
      metadata: { documentId: input.documentId },
    }, async (tx, grant) => {
      const obligation = await tx.complianceObligation.findFirst({
        where: {
          id: input.obligationId,
          clientId,
          organizationId: grant.organizationId,
          workspaceId: grant.workspaceId,
        },
        select: { id: true, status: true },
      });
      if (!obligation) throw new Error("PROFESSIONAL_PARTNER_OBLIGATION_NOT_FOUND");
      if (closedStatuses.has(obligation.status)) throw new Error("PROFESSIONAL_PARTNER_OBLIGATION_CLOSED");

      const document = await tx.document.findFirst({
        where: {
          id: input.documentId,
          clientId,
          workspaceId: grant.workspaceId,
          status: "AVAILABLE",
          scanStatus: "CLEAN",
          deletedAt: null,
          OR: [{ retainUntil: null }, { retainUntil: { gt: new Date() } }],
        },
        select: { id: true, uploadedByUserId: true },
      });
      if (!document) throw new Error("PROFESSIONAL_PARTNER_DOCUMENT_NOT_AVAILABLE");

      const existing = await tx.complianceEvidence.findFirst({
        where: {
          obligationId: obligation.id,
          workspaceId: grant.workspaceId,
          documentId: document.id,
        },
      });
      if (existing) return { evidence: existing, alreadyExists: true };

      const evidence = await tx.complianceEvidence.create({
        data: {
          workspaceId: grant.workspaceId,
          obligationId: obligation.id,
          documentId: document.id,
          // External partners can submit evidence, but can never self-assert primary/cross-verified status.
          evidenceClass: "E2",
          note: input.note ?? "Evidence submitted by an authorized professional partner; internal review required.",
          sourceReference: input.sourceReference ?? null,
          validThrough: input.validThrough ?? null,
          reviewStatus: "PENDING",
        },
      });
      await tx.complianceActivity.create({
        data: {
          obligationId: obligation.id,
          actorUserId: userId,
          action: "PARTNER_EVIDENCE_ATTACHED",
          note: input.note ?? "Partner evidence submitted for internal review.",
          metadata: {
            evidenceId: evidence.id,
            documentId: document.id,
            partnerIdentityId: grant.partnerIdentityId,
            grantId: grant.id,
            submittedAs: "E2",
            reviewStatus: "PENDING",
          },
        },
      });
      await tx.documentAccessEvent.create({
        data: {
          documentId: document.id,
          workspaceId: grant.workspaceId,
          actorUserId: userId,
          action: "PARTNER_EVIDENCE_LINKED",
          metadata: {
            clientId,
            obligationId: obligation.id,
            evidenceId: evidence.id,
            grantId: grant.id,
          },
        },
      });
      return { evidence, alreadyExists: false };
    });
    return NextResponse.json({ data: result.evidence, alreadyExists: result.alreadyExists }, { status: result.alreadyExists ? 200 : 201 });
  } catch (error) {
    if (isPartnerGrantDenied(error)) return NextResponse.json({ error: "Evidence submission is not available under an active professional partner grant." }, { status: 403 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_OBLIGATION_NOT_FOUND") return NextResponse.json({ error: "Obligation not found in the authorized client scope." }, { status: 404 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_OBLIGATION_CLOSED") return NextResponse.json({ error: "Evidence cannot be attached to a closed obligation." }, { status: 409 });
    if (error instanceof Error && error.message === "PROFESSIONAL_PARTNER_DOCUMENT_NOT_AVAILABLE") return NextResponse.json({ error: "Document must belong to this client and be available, clean, unexpired and not deleted." }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2004", "P2034"].includes(error.code)) return NextResponse.json({ error: "Evidence attachment conflicted with concurrent state or a database integrity rule. Refresh and retry." }, { status: 409 });
    console.error("Professional partner evidence attachment failed.");
    return NextResponse.json({ error: "Unable to attach partner evidence." }, { status: 500 });
  }
}
