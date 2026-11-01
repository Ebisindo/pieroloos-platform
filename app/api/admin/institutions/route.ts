import { NextResponse } from "next/server";
import { getCurrentPlatformActor } from "@/lib/auth/platform-access";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { prisma } from "@/lib/db/prisma";
import { recordPlatformAuditEvent } from "@/lib/services/platform-admin-service";
import { exportInstitutionCreateSchema } from "@/lib/validation/export-institution";

const MAX_BODY_BYTES = 32 * 1024;

export async function GET() {
  const actor = await getCurrentPlatformActor();
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!actor.isSuperAdmin) return NextResponse.json({ error: "Super Administrator access required." }, { status: 403 });

  try {
    const data = await prisma.exportInstitution.findMany({
      orderBy: [{ updatedAt: "desc" }],
      take: 200,
      include: { evidence: { orderBy: { observedAt: "desc" }, take: 5 } },
    });
    await recordPlatformAuditEvent({
      actorUserId: actor.userId, actorRole: "SUPER_ADMIN",
      action: "EXPORT_INSTITUTION_DIRECTORY_READ", outcome: "SUCCESS",
      details: { resultCount: data.length },
    });
    return NextResponse.json({ data });
  } catch {
    console.error("Unable to load export institution directory.");
    return NextResponse.json({ error: "Unable to load the institutional directory." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (hasInvalidRequestOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const actor = await getCurrentPlatformActor();
  if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  if (!actor.isSuperAdmin) return NextResponse.json({ error: "Super Administrator access required." }, { status: 403 });

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_BODY_BYTES) return NextResponse.json({ error: "Submission is too large." }, { status: 413 });
  const raw = await request.text().catch(() => null);
  if (raw === null || Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Submission is too large or unreadable." }, { status: 413 });
  }
  let body: unknown;
  try { body = JSON.parse(raw); } catch {
    return NextResponse.json({ error: "Submission must be valid JSON." }, { status: 400 });
  }
  const parsed = exportInstitutionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed.", issues: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  try {
    const input = parsed.data;
    const created = await prisma.exportInstitution.create({
      data: {
        officialName: input.officialName,
        acronym: input.acronym,
        aliases: input.aliases,
        category: input.category,
        scope: input.scope,
        countryCode: input.countryCode,
        jurisdictions: input.jurisdictions,
        officialWebsite: input.officialWebsite,
        mandateSummary: input.mandateSummary,
        services: input.services,
        collaborationAreas: input.collaborationAreas,
        relationshipStatus: "PROSPECTIVE_NOT_CONFIRMED",
        verificationStatus: "UNVERIFIED",
        publicProfileApproved: false,
        logoUseAuthorized: false,
        createdByUserId: actor.userId,
        evidence: input.initialEvidence.length ? {
          create: input.initialEvidence.map((evidence) => ({
            sourceUrl: evidence.sourceUrl,
            sourceTitle: evidence.sourceTitle,
            evidenceClass: evidence.evidenceClass,
            supportedClaim: evidence.supportedClaim,
            notes: evidence.notes,
          })),
        } : undefined,
      },
      select: { id: true, officialName: true, relationshipStatus: true, verificationStatus: true, createdAt: true },
    });
    await recordPlatformAuditEvent({
      actorUserId: actor.userId, actorRole: "SUPER_ADMIN",
      action: "EXPORT_INSTITUTION_CREATED", subjectType: "ExportInstitution",
      subjectId: created.id, outcome: "SUCCESS",
      details: { relationshipStatus: created.relationshipStatus, evidenceCount: input.initialEvidence.length },
    });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch {
    console.error("Unable to create export institution record.");
    return NextResponse.json({ error: "Unable to create the institutional record." }, { status: 500 });
  }
}
