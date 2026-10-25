import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { SuccessorStatus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { hasInvalidRequestOrigin } from "@/lib/auth/request-origin";
import { enforceRateLimit, PLATFORM_ADMIN_MUTATION_LIMIT } from "@/lib/http/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (hasInvalidRequestOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const limited = await enforceRateLimit(PLATFORM_ADMIN_MUTATION_LIMIT, "successor-invite-accept:" + (request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"));
  if (limited) return limited;
  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || !("token" in body) || typeof body.token !== "string" || body.token.length < 32 || body.token.length > 128) {
    return NextResponse.json({ error: "A valid invitation token is required." }, { status: 422 });
  }
  const tokenHash = createHash("sha256").update(body.token).digest("hex");
  const successor = await prisma.successor.findUnique({ where: { inviteTokenHash: tokenHash } });
  if (!successor || successor.status !== SuccessorStatus.PENDING || !successor.inviteExpiresAt || successor.inviteExpiresAt <= new Date()) {
    return NextResponse.json({ error: "This invitation is invalid, expired, or already used." }, { status: 410 });
  }
  // Acceptance only records a claim. The invitee must separately authenticate via the
  // configured identity provider and verify matching email + MFA before any role grant.
  const updated = await prisma.$transaction(async (tx) => {
    const claim = await tx.successor.updateMany({
      where: { id: successor.id, status: SuccessorStatus.PENDING, inviteTokenHash: tokenHash, inviteExpiresAt: { gt: new Date() } },
      data: { status: SuccessorStatus.ACCEPTED, acceptedAt: new Date(), inviteTokenHash: null, inviteExpiresAt: null },
    });
    if (!claim.count) return false;
    await tx.platformAuditEvent.create({ data: {
      actorRole: "SUCCESSOR_INVITEE", action: "successor_accepted", subjectType: "SUCCESSOR",
      subjectId: successor.id, outcome: "SUCCESS", details: { ownerId: successor.ownerId, emailClaimRecorded: true, adminAccessGranted: false },
    } });
    return true;
  }, { isolationLevel: "Serializable" });
  if (!updated) return NextResponse.json({ error: "This invitation has already been used." }, { status: 409 });
  return NextResponse.json({
    data: { accepted: true, successorId: successor.id, verificationLevel: successor.verificationLevel },
    nextStep: "Sign in using the configured organization identity provider, verify this invitation email, and complete the required MFA/identity review. Acceptance alone grants no platform access.",
  });
}
