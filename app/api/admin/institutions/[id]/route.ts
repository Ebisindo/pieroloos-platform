import { NextResponse } from "next/server";
import { getCurrentPlatformActor } from "@/lib/auth/platform-access";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { canTransitionExportInstitution, requiresWrittenEvidence } from "@/lib/domain/export-institution";
import { prisma } from "@/lib/db/prisma";
import { recordPlatformAuditEvent } from "@/lib/services/platform-admin-service";
import { exportInstitutionStatusSchema } from "@/lib/validation/export-institution";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await getCurrentPlatformActor();
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!actor.isSuperAdmin) return NextResponse.json({ error: "Super Administrator access required." }, { status: 403 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = exportInstitutionStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed.", issues: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  const { id } = await params;
  const current = await prisma.exportInstitution.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Institutional record not found." }, { status: 404 });
  if (!canTransitionExportInstitution(current.relationshipStatus, parsed.data.status)) {
    return NextResponse.json({
      error: "Invalid institutional relationship status transition.",
      from: current.relationshipStatus,
      to: parsed.data.status,
    }, { status: 409 });
  }
  if (requiresWrittenEvidence(parsed.data.status)) {
    if (!parsed.data.agreementEvidenceRef?.trim()) {
      return NextResponse.json({ error: "A reviewed written-authorization evidence reference is required for this status." }, { status: 422 });
    }
    const evidence = await prisma.exportInstitutionEvidence.findFirst({
      where: {
        id: parsed.data.agreementEvidenceRef,
        institutionId: id,
        evidenceClass: "OFFICIAL_PRIMARY",
        verifiedAt: { not: null },
      },
      select: { id: true },
    });
    if (!evidence) {
      return NextResponse.json({ error: "The evidence reference must identify reviewed official primary evidence for this institution." }, { status: 422 });
    }
  }
  if (parsed.data.status === "ACTIVE_UNDER_SIGNED_AGREEMENT") {
    const nextVerification = parsed.data.verificationStatus ?? current.verificationStatus;
    if (nextVerification !== "SOURCE_REVIEWED" && nextVerification !== "CROSS_VERIFIED") {
      return NextResponse.json({ error: "Reviewed source evidence is required before activating a partnership." }, { status: 422 });
    }
    const verifiedOfficialSources = await prisma.exportInstitutionEvidence.count({
      where: { institutionId: id, evidenceClass: "OFFICIAL_PRIMARY", verifiedAt: { not: null } },
    });
    if (!verifiedOfficialSources) {
      return NextResponse.json({ error: "At least one verified official primary source is required before activation." }, { status: 422 });
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.exportInstitution.update({
        where: { id },
        data: {
          relationshipStatus: parsed.data.status,
          agreementEvidenceRef: parsed.data.agreementEvidenceRef ?? current.agreementEvidenceRef,
          verificationStatus: parsed.data.verificationStatus ?? current.verificationStatus,
          lastVerifiedAt: parsed.data.verificationStatus ? new Date() : current.lastVerifiedAt,
          // Status transitions never publish profiles or authorize logo use.
          publicProfileApproved: current.publicProfileApproved,
          logoUseAuthorized: current.logoUseAuthorized,
        },
        select: { id: true, officialName: true, relationshipStatus: true, verificationStatus: true, agreementEvidenceRef: true },
      });
      await tx.platformAuditEvent.create({
        data: {
          actorUserId: actor.userId,
          actorRole: "SUPER_ADMIN",
          action: "EXPORT_INSTITUTION_STATUS_CHANGED",
          subjectType: "ExportInstitution",
          subjectId: id,
          outcome: "SUCCESS",
          reason: parsed.data.reason,
          details: {
            fromStatus: current.relationshipStatus,
            toStatus: parsed.data.status,
            fromVerificationStatus: current.verificationStatus,
            toVerificationStatus: parsed.data.verificationStatus ?? current.verificationStatus,
            evidenceReferenceProvided: Boolean(parsed.data.agreementEvidenceRef),
          },
        },
      });
      return result;
    });
    return NextResponse.json({ data: updated });
  } catch {
    console.error("Unable to update export institution status.");
    return NextResponse.json({ error: "Unable to update the institutional record." }, { status: 500 });
  }
}
