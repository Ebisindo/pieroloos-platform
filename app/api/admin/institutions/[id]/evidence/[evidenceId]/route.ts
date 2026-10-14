import { NextResponse } from "next/server";
import { getCurrentPlatformActor } from "@/lib/auth/platform-access";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { prisma } from "@/lib/db/prisma";
import { recordPlatformAuditEvent } from "@/lib/services/platform-admin-service";
import { z } from "zod";

const schema = z.object({
  decision: z.enum(["VERIFY", "REQUEST_CORRECTION"]),
  reason: z.string().trim().min(5).max(1000),
  nextReviewAt: z.string().datetime().optional(),
}).strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; evidenceId: string }> },
) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const actor = await getCurrentPlatformActor();
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!actor.isSuperAdmin) return NextResponse.json({ error: "Super Administrator access required." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed.", issues: parsed.error.flatten().fieldErrors }, { status: 422 });
  const { id, evidenceId } = await params;
  const evidence = await prisma.exportInstitutionEvidence.findFirst({ where: { id: evidenceId, institutionId: id } });
  if (!evidence) return NextResponse.json({ error: "Institutional evidence not found." }, { status: 404 });
  if (parsed.data.decision === "VERIFY" && evidence.evidenceClass === "OFFICIAL_PRIMARY" && !evidence.sourceUrl) {
    return NextResponse.json({ error: "Official primary evidence requires a source URL." }, { status: 422 });
  }
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.exportInstitutionEvidence.update({
        where: { id: evidenceId },
        data: {
          reviewerUserId: actor.userId,
          verifiedAt: parsed.data.decision === "VERIFY" ? new Date() : null,
          nextReviewAt: parsed.data.nextReviewAt ? new Date(parsed.data.nextReviewAt) : null,
          notes: [evidence.notes, `Review (${parsed.data.decision}) by ${actor.userId}: ${parsed.data.reason}`].filter(Boolean).join("\n"),
        },
        select: { id: true, institutionId: true, evidenceClass: true, verifiedAt: true, nextReviewAt: true },
      });
      const verifiedCount = await tx.exportInstitutionEvidence.count({
        where: { institutionId: id, verifiedAt: { not: null }, evidenceClass: "OFFICIAL_PRIMARY" },
      });
      await tx.exportInstitution.update({
        where: { id },
        data: {
          verificationStatus: verifiedCount > 0 ? "SOURCE_REVIEWED" : "UNVERIFIED",
          lastVerifiedAt: verifiedCount > 0 ? new Date() : null,
        },
      });
      await tx.platformAuditEvent.create({
        data: {
          actorUserId: actor.userId, actorRole: "SUPER_ADMIN",
          action: "EXPORT_INSTITUTION_EVIDENCE_REVIEWED",
          subjectType: "ExportInstitutionEvidence", subjectId: evidenceId, outcome: "SUCCESS",
          reason: parsed.data.reason,
          details: { institutionId: id, decision: parsed.data.decision, evidenceClass: evidence.evidenceClass },
        },
      });
      return row;
    });
    return NextResponse.json({ data: updated });
  } catch {
    console.error("Unable to review institutional evidence.");
    return NextResponse.json({ error: "Unable to review institutional evidence." }, { status: 500 });
  }
}
