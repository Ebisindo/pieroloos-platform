import { NextResponse } from "next/server";
import { getCurrentPlatformActor } from "@/lib/auth/platform-access";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { prisma } from "@/lib/db/prisma";
import { recordPlatformAuditEvent } from "@/lib/services/platform-admin-service";
import { z } from "zod";

const schema = z.object({
  sourceUrl: z.string().url().max(2048).refine((value) => {
    try { const u = new URL(value); return ["http:", "https:"].includes(u.protocol) && !u.username && !u.password; }
    catch { return false; }
  }),
  sourceTitle: z.string().trim().min(2).max(240),
  evidenceClass: z.enum(["OFFICIAL_PRIMARY", "SECONDARY", "USER_PROVIDED", "INTERNAL_ASSESSMENT", "OTHER"]),
  supportedClaim: z.string().trim().min(5).max(1000),
  notes: z.string().trim().max(2000).optional(),
}).strict();

export async function POST(
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
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Validation failed.", issues: parsed.error.flatten().fieldErrors }, { status: 422 });
  const { id } = await params;
  const institution = await prisma.exportInstitution.findUnique({ where: { id }, select: { id: true } });
  if (!institution) return NextResponse.json({ error: "Institutional record not found." }, { status: 404 });
  try {
    const evidence = await prisma.exportInstitutionEvidence.create({
      data: { institutionId: id, ...parsed.data },
      select: { id: true, sourceUrl: true, sourceTitle: true, evidenceClass: true, supportedClaim: true, verifiedAt: true, observedAt: true },
    });
    await recordPlatformAuditEvent({
      actorUserId: actor.userId, actorRole: "SUPER_ADMIN", action: "EXPORT_INSTITUTION_EVIDENCE_ADDED",
      subjectType: "ExportInstitutionEvidence", subjectId: evidence.id, outcome: "SUCCESS",
      details: { institutionId: id, evidenceClass: evidence.evidenceClass },
    });
    return NextResponse.json({ data: evidence }, { status: 201 });
  } catch {
    console.error("Unable to add institutional evidence.");
    return NextResponse.json({ error: "Unable to add institutional evidence." }, { status: 500 });
  }
}
